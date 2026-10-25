import { Router } from 'express';
import { z } from 'zod';
import Lead from '../models/Lead.js';
import Property from '../models/Property.js';
import Activity from '../models/Activity.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, HttpError, sendData, objectId, escapeRegex } from '../utils/http.js';
const router=Router(); router.use(authenticate);
const stages=['New','Contacted','Qualified','Negotiation','Closed'];
const sources=['Website','Referral','Zillow','Open House','Social Media','Cold Call','Other'];
const fields={name:z.string().trim().min(1).max(160),email:z.string().trim().email().max(254).or(z.literal('')).optional(),phone:z.string().trim().max(40).optional(),budget:z.coerce.number().min(0).optional(),interest_property_id:z.string().nullable().optional(),stage:z.enum(stages).optional(),source:z.enum(sources).optional(),notes:z.string().max(10000).optional(),assigned_to:z.string().nullable().optional()};
const createSchema=z.object({name:fields.name,email:fields.email,phone:fields.phone,budget:fields.budget,interest_property_id:fields.interest_property_id,stage:fields.stage,source:fields.source,notes:fields.notes,assigned_to:fields.assigned_to}).strict();
const updateSchema=createSchema.partial().refine(o=>Object.keys(o).length>0,'At least one field is required');
async function checkRefs(body,workspaceId){
 if(body.interest_property_id){if(!objectId(body.interest_property_id)||!await Property.exists({_id:body.interest_property_id,workspace_id:workspaceId}))throw new HttpError(400,'Property does not exist in this workspace');}
 if(body.assigned_to){const User=(await import('../models/User.js')).default;if(!objectId(body.assigned_to)||!await User.exists({_id:body.assigned_to,workspace_id:workspaceId,is_active:true}))throw new HttpError(400,'Assignee does not exist in this workspace');}
}
router.get('/',asyncHandler(async(req,res)=>{
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||100)),filter={workspace_id:req.user.workspace_id};
 if(stages.includes(req.query.stage))filter.stage=req.query.stage;
 if(req.query.search){const rx=new RegExp(escapeRegex(String(req.query.search).slice(0,100)),'i');filter.$or=[{name:rx},{email:rx},{phone:rx}];}
 const [data,total]=await Promise.all([Lead.find(filter).sort({created_at:-1}).skip((page-1)*limit).limit(limit).lean(),Lead.countDocuments(filter)]);
 res.json({data,meta:{page,limit,total}});
}));
router.post('/',validate(createSchema),asyncHandler(async(req,res)=>{
 await checkRefs(req.body,req.user.workspace_id);
 const lead=await Lead.create({...req.body,workspace_id:req.user.workspace_id,created_by:req.user.id});
 await audit(req,'create','lead',lead._id); req.app.get('io').to(req.user.workspace_id).emit('lead:updated',{id:String(lead._id),action:'created'}); sendData(res,lead,201);
}));
router.get('/:id',asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id))throw new HttpError(400,'Invalid lead id');
 const item=await Lead.findOne({_id:req.params.id,workspace_id:req.user.workspace_id}).lean();if(!item)throw new HttpError(404,'Lead not found');sendData(res,item);
}));
router.patch('/:id',validate(updateSchema),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id))throw new HttpError(400,'Invalid lead id');
 await checkRefs(req.body,req.user.workspace_id);
 const item=await Lead.findOneAndUpdate({_id:req.params.id,workspace_id:req.user.workspace_id},{$set:req.body},{new:true,runValidators:true});
 if(!item)throw new HttpError(404,'Lead not found');await audit(req,'update','lead',item._id);
 req.app.get('io').to(req.user.workspace_id).emit('lead:updated',{id:String(item._id),action:'updated',stage:item.stage});sendData(res,item);
}));
router.delete('/:id',allowRoles('admin','manager'),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id))throw new HttpError(400,'Invalid lead id');
 const item=await Lead.findOneAndDelete({_id:req.params.id,workspace_id:req.user.workspace_id});if(!item)throw new HttpError(404,'Lead not found');
 await Activity.deleteMany({workspace_id:req.user.workspace_id,lead_id:item._id});await audit(req,'delete','lead',item._id);
 req.app.get('io').to(req.user.workspace_id).emit('lead:updated',{id:String(item._id),action:'deleted'});sendData(res,{deleted:true});
}));
export default router;
