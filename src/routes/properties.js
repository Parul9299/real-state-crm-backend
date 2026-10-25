import { Router } from 'express';
import { z } from 'zod';
import Property from '../models/Property.js';
import Lead from '../models/Lead.js';
import { authenticate, allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { audit } from '../middleware/audit.js';
import { asyncHandler, HttpError, sendData, objectId, escapeRegex } from '../utils/http.js';

const router = Router(); router.use(authenticate);
const types = ['House','Apartment','Condo','Villa','Townhouse','Penthouse','Land'];
const statuses = ['Available','Pending','Sold','Off Market'];
const fields = {
 title: z.string().trim().min(1).max(160), address: z.string().trim().min(1).max(240), city: z.string().trim().min(1).max(120),
 price: z.coerce.number().min(0), beds: z.coerce.number().int().min(0).max(100), baths: z.coerce.number().min(0).max(100),
 area_sqft: z.coerce.number().min(0), type: z.enum(types), status: z.enum(statuses),
 description: z.string().max(5000).optional(), image_url: z.string().max(2048).optional(), listed_date: z.string().date().optional()
};
const createSchema = z.object(fields).strict();
const updateSchema = createSchema.partial().refine(o => Object.keys(o).length > 0, 'At least one field is required');
router.get('/', asyncHandler(async (req,res) => {
 const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
 const filter = { workspace_id: req.user.workspace_id };
 if (statuses.includes(req.query.status)) filter.status = req.query.status;
 if (req.query.search) { const rx = new RegExp(escapeRegex(String(req.query.search).slice(0,100)), 'i'); filter.$or = [{title:rx},{city:rx},{address:rx}]; }
 const [data,total] = await Promise.all([Property.find(filter).sort({created_at:-1}).skip((page-1)*limit).limit(limit).lean(),Property.countDocuments(filter)]);
 res.json({data,meta:{page,limit,total}});
}));
router.post('/', validate(createSchema), asyncHandler(async(req,res)=>{
 const property=await Property.create({...req.body,workspace_id:req.user.workspace_id,created_by:req.user.id});
 await audit(req,'create','property',property._id); req.app.get('io').to(req.user.workspace_id).emit('property:updated',{id:String(property._id),action:'created'});
 sendData(res,property,201);
}));
router.get('/:id', asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id)) throw new HttpError(400,'Invalid property id');
 const item=await Property.findOne({_id:req.params.id,workspace_id:req.user.workspace_id}).lean(); if(!item) throw new HttpError(404,'Property not found'); sendData(res,item);
}));
router.patch('/:id',validate(updateSchema),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id)) throw new HttpError(400,'Invalid property id');
 const item=await Property.findOneAndUpdate({_id:req.params.id,workspace_id:req.user.workspace_id},{$set:req.body},{new:true,runValidators:true});
 if(!item) throw new HttpError(404,'Property not found'); await audit(req,'update','property',item._id);
 req.app.get('io').to(req.user.workspace_id).emit('property:updated',{id:String(item._id),action:'updated'}); sendData(res,item);
}));
router.delete('/:id',allowRoles('admin','manager'),asyncHandler(async(req,res)=>{
 if(!objectId(req.params.id)) throw new HttpError(400,'Invalid property id');
 const linked=await Lead.exists({workspace_id:req.user.workspace_id,interest_property_id:req.params.id});
 if(linked) throw new HttpError(409,'This property is linked to one or more leads. Archive it instead.');
 const item=await Property.findOneAndDelete({_id:req.params.id,workspace_id:req.user.workspace_id}); if(!item) throw new HttpError(404,'Property not found');
 await audit(req,'delete','property',item._id); req.app.get('io').to(req.user.workspace_id).emit('property:updated',{id:String(item._id),action:'deleted'}); sendData(res,{deleted:true});
}));
export default router;
