import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import Workspace from '../models/Workspace.js';
import User from '../models/User.js';

try {
 if(!env.ADMIN_NAME||!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD||!env.WORKSPACE_NAME) {
  throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD and WORKSPACE_NAME in .env first');
 }
 if(env.ADMIN_PASSWORD.length<8) throw new Error('ADMIN_PASSWORD must be at least 14 characters');
 await connectDatabase();
 const email=env.ADMIN_EMAIL.toLowerCase();
 if(await User.exists({email})) {
  console.log('Admin email already exists; no changes made.');
 } else {
  const workspace=await Workspace.create({name:env.WORKSPACE_NAME});
  const password_hash=await bcrypt.hash(env.ADMIN_PASSWORD,12);
  await User.create({workspace_id:workspace._id,name:env.ADMIN_NAME,email,password_hash,role:'admin'});
  console.log(`Created initial admin ${email} and workspace ${workspace.name}`);
 }
} catch(err) {
 console.error(err.message);
 process.exitCode=1;
} finally {
 const mongoose=(await import('mongoose')).default;
 await mongoose.disconnect().catch(()=>{});
}
