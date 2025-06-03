// Firebase Configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "rasheed-sons-emed.firebaseapp.com",
  databaseURL: "https://rasheed-sons-emed-default-rtdb.firebaseio.com",
  projectId: "rasheed-sons-emed",
  storageBucket: "rasheed-sons-emed.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Error handling wrapper
async function secureOperation(operation) {
  try {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('Authentication required');
    }
    
    // Verify token is not expired
    await user.getIdToken(true);
    
    return await operation();
  } catch (error) {
    console.error('Operation error:', error);
    throw error;
  }
}

// Save order to Firebase - No auth required for customers
function saveOrderToFirebase(order) {
  if (!order || !order.id || !order.customer || !order.items) {
    throw new Error('Invalid order data');
  }
  
  // Sanitize order data
  const sanitizedOrder = {
    id: order.id,
    date: order.date,
    customer: {
      name: String(order.customer.name),
      phone: String(order.customer.phone),
      address: String(order.customer.address)
    },
    items: order.items.map(item => ({
      id: String(item.id),
      name: String(item.name),
      price: Number(item.price),
      quantity: Number(item.quantity)
    })),
    total: Number(order.total),
    deliveryCharge: Number(order.deliveryCharge),
    status: 'pending'
  };
  
  return database.ref('orders').push(sanitizedOrder);
}

// Get all orders from Firebase - Requires seller auth
function getAllOrders() {
  return secureOperation(async () => {
    const snapshot = await database.ref('orders').once('value');
    const orders = [];
    snapshot.forEach((childSnapshot) => {
      orders.push({
        ...childSnapshot.val(),
        firebaseKey: childSnapshot.key
      });
    });
    return orders;
  });
}

// Update order status in Firebase - Requires seller auth
function updateOrderStatus(orderId, newStatus) {
  const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status value');
  }
  
  return secureOperation(async () => {
    const snapshot = await database.ref('orders')
      .orderByChild('id')
      .equalTo(orderId)
      .once('value');
    
    if (!snapshot.exists()) {
      throw new Error('Order not found');
    }
    
    const orderKey = Object.keys(snapshot.val())[0];
    return database.ref('orders').child(orderKey).update({ 
      status: newStatus,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      updatedBy: firebase.auth().currentUser.email
    });
  });
}

// Get single order from Firebase - Requires seller auth for full details
function getOrderById(orderId) {
  return secureOperation(async () => {
    const snapshot = await database.ref('orders')
      .orderByChild('id')
      .equalTo(orderId)
      .once('value');
    
    if (!snapshot.exists()) {
      throw new Error('Order not found');
    }
    
    return Object.values(snapshot.val())[0];
  });
}

// Listen for new orders in real-time - Requires seller auth
function listenForNewOrders(callback) {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error('Authentication required');
  }
  
  const ordersRef = database.ref('orders');
  ordersRef.on('child_added', (snapshot) => {
    const newOrder = {
      ...snapshot.val(),
      firebaseKey: snapshot.key
    };
    callback(newOrder);
  }, (error) => {
    console.error('Order listener error:', error);
  });
}

// Listen for order status changes in real-time - Requires seller auth
function listenForOrderChanges(callback) {
  const user = firebase.auth().currentUser;
  if (!user) {
    throw new Error('Authentication required');
  }
  
  const ordersRef = database.ref('orders');
  ordersRef.on('child_changed', (snapshot) => {
    const updatedOrder = {
      ...snapshot.val(),
      firebaseKey: snapshot.key
    };
    callback(updatedOrder);
  }, (error) => {
    console.error('Order update listener error:', error);
  });
}

// Stop listening to real-time updates
function stopListening() {
  database.ref('orders').off();
}

// Export functions
export {
  saveOrderToFirebase,
  getAllOrders,
  updateOrderStatus,
  getOrderById,
  listenForNewOrders,
  listenForOrderChanges,
  stopListening
}; 