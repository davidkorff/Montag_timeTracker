const db = require('../../config/database');

const getUserPreferences = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT preference_key, preference_value FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );
    
    // Convert array to object for easier access
    const preferences = {};
    result.rows.forEach(row => {
      try {
        // Try to parse JSON values
        preferences[row.preference_key] = JSON.parse(row.preference_value);
      } catch {
        // If not JSON, use raw value
        preferences[row.preference_key] = row.preference_value;
      }
    });
    
    res.json({ preferences });
  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUserPreference = async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Preference key is required' });
    }
    
    // Convert value to string (JSON if object/array)
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    // Upsert the preference
    await db.query(
      `INSERT INTO user_preferences (user_id, preference_key, preference_value) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (user_id, preference_key) 
       DO UPDATE SET preference_value = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, key, valueStr]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update user preference error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteUserPreference = async (req, res) => {
  try {
    const { key } = req.params;
    
    await db.query(
      'DELETE FROM user_preferences WHERE user_id = $1 AND preference_key = $2',
      [req.user.id, key]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user preference error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  getUserPreferences,
  updateUserPreference,
  deleteUserPreference
};