const jwt = require('jsonwebtoken');
const db = require('../../config/database');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.user_type_id,
              ut.name as user_type_name
       FROM users u
       JOIN user_types ut ON u.user_type_id = ut.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw new Error();
    }

    const user = userResult.rows[0];
    req.user = {
      ...user,
      role: user.user_type_name.toLowerCase() // For backward compatibility
    };
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

const authorize = (roles) => {
  return (req, res, next) => {
    // Handle both old role names and new user type names
    const userRole = req.user.role || req.user.user_type_name?.toLowerCase();
    
    // Map old role names to new ones
    const roleMapping = {
      'admin': ['admin'],
      'consultant': ['contractor', 'admin']
    };
    
    let authorized = false;
    for (const requiredRole of roles) {
      const allowedRoles = roleMapping[requiredRole] || [requiredRole];
      if (allowedRoles.includes(userRole)) {
        authorized = true;
        break;
      }
    }
    
    if (!authorized) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };