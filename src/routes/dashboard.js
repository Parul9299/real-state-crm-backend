import { Router } from 'express';
import Property from '../models/Property.js';
import Lead from '../models/Lead.js';
import Activity from '../models/Activity.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, sendData } from '../utils/http.js';
const router = Router(); router.use(authenticate);
router.get('/', asyncHandler(async (req, res) => {
    const w = req.user.workspace_id;
    const [totalProperties, availableProperties, portfolioValue, leadCounts, activeLeads, closedLeads, upcomingActivities, recentLeads, featuredProperties] = await Promise.all([
        Property.countDocuments({ workspace_id: w }),
        Property.countDocuments({ workspace_id: w, status: 'Available' }),
        Property.aggregate([{ $match: { workspace_id: (await import('mongoose')).default.Types.ObjectId.createFromHexString(w) } }, { $group: { _id: null, total: { $sum: '$price' } } }]),
        Lead.aggregate([{ $match: { workspace_id: (await import('mongoose')).default.Types.ObjectId.createFromHexString(w) } }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
        Lead.countDocuments({ workspace_id: w, stage: { $ne: 'Closed' } }),
        Lead.countDocuments({ workspace_id: w, stage: 'Closed' }),
        Activity.find({ workspace_id: w, completed: false }).sort({ due_date: 1 }).limit(5).lean(),
        Lead.find({ workspace_id: w }).sort({ created_at: -1 }).limit(5).lean(),
        Property.find({ workspace_id: w }).sort({ created_at: -1 }).limit(4).lean()
    ]);
    sendData(res, { properties: { total: totalProperties, available: availableProperties, portfolio_value: portfolioValue[0]?.total || 0, featured: featuredProperties }, leads: { active: activeLeads, closed: closedLeads, stages: leadCounts, recent: recentLeads, close_rate: activeLeads + closedLeads ? Math.round(closedLeads / (activeLeads + closedLeads) * 100) : 0 }, upcoming_activities: upcomingActivities });
}));
export default router;
