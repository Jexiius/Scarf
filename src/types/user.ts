export interface UserPayload {
  id: string;
  email: string;
  subscriptionTier: 'free' | 'premium';
  isAdmin?: boolean; // Optional admin flag for monitoring access
}
