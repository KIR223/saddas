import { login, me, endSession } from '../api/client.js';
let user = null;
export const isLoggedIn = () => user?.role === 'admin' && user.status === 'active';
export const getCurrentUser = () => user;
export const touchSession = () => {};
export const getAuthLockStatus = () => ({locked:false,remainingMs:0,attemptsLeft:5});
export async function refreshSession() { try { user=await me(); } catch { user=null; } return user; }
export async function tryLogin(name,password) {
  try { user=await login(name.trim(),password); return {ok:true,user}; }
  catch(e) { user=null; return {ok:false,error:e.message}; }
}
export async function logout() { user=null; await endSession().catch(()=>{}); }
