// Stripe utility for client-side integration
import { loadStripe } from '@stripe/stripe-js';

// Load Stripe with the publishable key
// Environment-based Stripe key configuration
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51RHqqmHB5ozd2g6ByghkLPL7HAYAWJPswOqcXruAWfAmyazUwAjkBCvjfvGbtmquJ5adjWSOFx7kIwbsmNsTJDyE00spa70EJK';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

export { stripePromise };

// Redirect to Stripe Checkout
export const redirectToCheckout = async (sessionId) => {
  const stripe = await stripePromise;
  
  if (!stripe) {
    throw new Error('Stripe failed to load');
  }

  const { error } = await stripe.redirectToCheckout({
    sessionId: sessionId,
  });

  if (error) {
    throw error;
  }
};

// Handle payment success/failure from URL parameters
export const getPaymentStatusFromURL = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get('success');
  const canceled = urlParams.get('canceled');
  const sessionId = urlParams.get('session_id');

  return {
    success: success === 'true',
    canceled: canceled === 'true',
    sessionId: sessionId
  };
};

// Clean URL parameters after handling payment status
export const cleanPaymentURL = () => {
  if (window.history && window.history.replaceState) {
    const cleanURL = window.location.pathname;
    window.history.replaceState({}, document.title, cleanURL);
  }
};
