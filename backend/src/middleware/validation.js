const { body, param, query } = require('express-validator');

const authValidation = {
  signup: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim()
  ],
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().isLength({ min: 6 })
  ],
  changePassword: [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ]
};

const userValidation = {
  create: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('userTypeId').optional().isInt({ min: 1, max: 3 }),
    body('hourlyRate').optional().isFloat({ min: 0 })
  ],
  update: [
    body('email').optional().isEmail().normalizeEmail(),
    body('firstName').optional().notEmpty().trim(),
    body('lastName').optional().notEmpty().trim(),
    body('hourlyRate').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean()
  ]
};

const clientValidation = {
  create: [
    body('name').notEmpty().trim(),
    body('code').optional().trim(),
    body('contactEmail').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('contactPhone').optional().trim(),
    body('address').optional().trim(),
    body('billingRate').optional().isFloat({ min: 0 })
  ],
  update: [
    body('name').optional().notEmpty().trim(),
    body('code').optional().trim(),
    body('contactEmail').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('contactPhone').optional().trim(),
    body('address').optional().trim(),
    body('billingRate').optional().isFloat({ min: 0 }),
    body('isActive').optional().isBoolean()
  ]
};

const projectValidation = {
  create: [
    body('clientId').custom((value) => {
      if (!value) throw new Error('Client ID is required');
      // Accept either integer or UUID
      const isInt = /^\d+$/.test(value);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isInt && !isUUID) throw new Error('Invalid client ID format');
      return true;
    }),
    body('name').notEmpty().trim(),
    body('code').optional({ nullable: true }).trim(),
    body('description').optional({ nullable: true }).trim(),
    body('budgetHours').optional({ nullable: true }).isFloat({ min: 0 }),
    body('budgetAmount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('startDate').optional({ nullable: true }).isDate(),
    body('endDate').optional({ nullable: true }).isDate(),
    body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled']),
    body('hourlyRate').optional({ nullable: true }).isFloat({ min: 0 })
  ],
  update: [
    body('name').optional().notEmpty().trim(),
    body('code').optional({ nullable: true }).trim(),
    body('description').optional({ nullable: true }).trim(),
    body('budgetHours').optional({ nullable: true }).isFloat({ min: 0 }),
    body('budgetAmount').optional({ nullable: true }).isFloat({ min: 0 }),
    body('startDate').optional({ nullable: true }).isDate(),
    body('endDate').optional({ nullable: true }).isDate(),
    body('status').optional().isIn(['active', 'completed', 'on_hold', 'cancelled']),
    body('hourlyRate').optional({ nullable: true }).isFloat({ min: 0 })
  ]
};

const timeEntryValidation = {
  create: [
    body('projectId').custom((value) => {
      if (!value) throw new Error('Project ID is required');
      const isInt = /^\d+$/.test(value);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isInt && !isUUID) throw new Error('Invalid project ID format');
      return true;
    }),
    body('date').isDate(),
    body('hours').isFloat({ min: 0.01, max: 24 }),
    body('description').optional().trim(),
    body('isBillable').optional().isBoolean()
  ],
  update: [
    body('projectId').optional().custom((value) => {
      if (value === undefined || value === null) return true;
      const isInt = /^\d+$/.test(value);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isInt && !isUUID) throw new Error('Invalid project ID format');
      return true;
    }),
    body('date').optional().isDate(),
    body('hours').optional().isFloat({ min: 0.01, max: 24 }),
    body('description').optional().trim(),
    body('isBillable').optional().isBoolean(),
    body('status').optional().isIn(['draft', 'submitted', 'approved', 'rejected'])
  ],
  timer: [
    body('projectId').custom((value) => {
      if (!value) throw new Error('Project ID is required');
      const isInt = /^\d+$/.test(value);
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      if (!isInt && !isUUID) throw new Error('Invalid project ID format');
      return true;
    }),
    body('description').optional().trim(),
    body('isBillable').optional().isBoolean()
  ]
};

const idValidation = [
  param('id').custom((value) => {
    // Accept either UUID or integer ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    const isInt = /^\d+$/.test(value);
    if (!isUUID && !isInt) {
      throw new Error('Invalid ID format');
    }
    return true;
  })
];

const dateRangeValidation = [
  query('startDate').optional().isDate(),
  query('endDate').optional().isDate()
];

module.exports = {
  authValidation,
  userValidation,
  clientValidation,
  projectValidation,
  timeEntryValidation,
  idValidation,
  dateRangeValidation
};