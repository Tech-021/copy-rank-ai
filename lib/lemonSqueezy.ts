// lib/lemonSqueezy.ts
export interface LemonSqueezyCheckout {
  url: string;
}

export const createTrialCheckout = async (
  userEmail: string, 
  userName?: string,
  userId?: string
): Promise<LemonSqueezyCheckout> => {
  try {
    const response = await fetch('/api/lemonsqueezy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userEmail,
        userName,
        userId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout');
    }

    const data = await response.json();
    return { url: data.checkoutUrl };
    
  } catch (error) {
    console.error('LemonSqueezy checkout error:', error);
    throw error;
  }
};