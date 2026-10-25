import { Router } from 'express';
import { z } from 'zod';
import Activity from '../models/Activity.js';
import Lead from '../models/Lead.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, HttpError, sendData, objectId } from '../utils/http.js';
const router=Router();router.use(authenticate);
const schema=z.object({lead_id:z.string().regex(/^[a-f\d]{24}$/i),type:z.enum(['Call','Email','Meeting','Showing','Note']).default('Call'),description:z.string().trim().min(1).max(3000),due_date:z.string().date().nullable().optional(),completed:z.boolean().optional()}).strict();
const patchSchema=schema.partial().refine(o=>Object.keys(o).length>0,'At least one field is required');
router.get('/',asyncHandler(async(req,res)=>{
 const filter={workspace_id:req.user.workspace_id};if(req.query.lead_id){if(!objectId(req.query.lead_id))throw new HttpError(400,'Invalid lead id');filter.lead_id=req.query.lead_id;}
 if(req.query.completed==='true')filter.completed=true;if(req.query.completed==='false')filter.completed=false;
 const data=await Activity.find(filter).sort({due_date:1,created_at:-1}).limit(500).lean();sendData(res,data);
}));
router.post('/',validate(schema),asyncHandler(async(req,res)=>{
 if(!await Lead.exists({_id:req.body.lead_id,workspace_id:req.user.workspace_id}))throw new HttpError(400,'Lead does not exist in this workspace');
 const item=await Activity.create({...req.body,workspace_id:req.user.workspace_id,created_by:req.user.id});
 await audit(req,'create','activity',item._id);req.app.get('io').to(req.user.workspace_id).emit('activity:updated',{id:String(item._id),lead_id:String(item.lead_id),action:'created'});sendData(res,item,201);
}));
router.patch('/:id',validate(patchSchema),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id))throw new HttpError(400,'Invalid activity id');
 if(req.body.lead_id&&!await Lead.exists({_id:req.body.lead_id,workspace_id:req.user.workspace_id}))throw new HttpError(400,'Lead does not exist in this workspace');
 const item=await Activity.findOneAndUpdate({_id:req.params.id,workspace_id:req.user.workspace_id},{$set:req.body},{new:true,runValidators:true});
 if(!item)throw new HttpError(404,'Activity not found');await audit(req,'update','activity',item._id);
 req.app.get('io').to(req.user.workspace_id).emit('activity:updated',{id:String(item._id),lead_id:String(item.lead_id),action:'updated'});sendData(res,item);
}));
router.delete('/:id',allowRoles('admin','manager'),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id))throw new HttpError(400,'Invalid activity id');
 const item=await Activity.findOneAndDelete({_id:req.params.id,workspace_id:req.user.workspace_id});if(!item)throw new HttpError(404,'Activity not found');
 await audit(req,'delete','activity',item._id);req.app.get('io').to(req.user.workspace_id).emit('activity:updated',{id:String(item._id),lead_id:String(item.lead_id),action:'deleted'});sendData(res,{deleted:true});
}));
export default router;
