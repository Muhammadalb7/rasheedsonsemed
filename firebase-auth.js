// Initialize Firebase Auth
const auth = firebase.auth();

// Function to sign in seller
async function signInSeller(email, password) {
  try {
    // First sign in with email and password
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    
    // Then verify if the user is a seller
    const functions = firebase.functions();
    const verifySellerFunction = functions.httpsCallable('verifySeller');
    const result = await verifySellerFunction();
    
    if (!result.data.isSeller) {
      // If not a seller, sign out and throw error
      await auth.signOut();
      throw new Error('Access denied. Not authorized as a seller.');
    }
    
    return userCredential;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

// Function to sign out
async function signOut() {
  try {
    await auth.signOut();
    // Clear any cached seller data
    localStorage.removeItem('lastLoginTime');
    stopListening(); // Stop listening to order updates
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

// Function to check if user is authenticated and is a seller
async function isAuthenticatedSeller() {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const functions = firebase.functions();
    const verifySellerFunction = functions.httpsCallable('verifySeller');
    const result = await verifySellerFunction();
    return result.data.isSeller;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

// Function to get current user
function getCurrentUser() {
  return auth.currentUser;
}

// Function to refresh authentication
async function refreshAuth() {
  const user = auth.currentUser;
  if (user) {
    try {
      await user.getIdToken(true); // Force token refresh
      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }
  return false;
}

// Set up authentication state observer and get user data
auth.onAuthStateChanged(async (user) => {
  if (user) {
    try {
      // Verify seller status
      const isSeller = await isAuthenticatedSeller();
      if (isSeller) {
        console.log('Seller signed in:', user.email);
        // Update last login time
        localStorage.setItem('lastLoginTime', new Date().toISOString());
        
        // Enable real-time order updates
        listenForNewOrders((newOrder) => {
          loadDashboardData();
        });
        
        listenForOrderChanges((updatedOrder) => {
          loadDashboardData();
        });
        
        // Set up token refresh
        setInterval(refreshAuth, 30 * 60 * 1000); // Refresh token every 30 minutes
      } else {
        console.warn('Non-seller attempted to access dashboard');
        await signOut();
      }
    } catch (error) {
      console.error('Auth state change error:', error);
      await signOut();
    }
  } else {
    console.log('User is signed out');
    stopListening();
  }
});

// Export functions
export {
  signInSeller,
  signOut,
  isAuthenticatedSeller,
  getCurrentUser,
  refreshAuth
}; 