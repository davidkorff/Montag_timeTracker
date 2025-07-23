const db = require('../../config/database');

const getOverviewStats = async (req, res) => {
  try {
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    // Get date ranges
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    
    // Total revenue (calculated from time entries to avoid invoice duplication)
    const revenueQuery = `
      SELECT 
        SUM(CASE WHEN te.date >= $1 THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue_ytd,
        SUM(CASE WHEN te.date >= $2 THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue_mtd,
        SUM(CASE WHEN te.date >= $3 THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue_wtd,
        SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as revenue_all_time,
        SUM(CASE WHEN i.payment_status = 'paid' THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue_collected,
        SUM(CASE WHEN i.payment_status != 'paid' OR i.id IS NULL THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue_outstanding
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN invoices i ON te.invoice_id = i.id
      WHERE te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ${userId ? 'AND te.user_id = $4' : ''}
    `;
    
    const revenueResult = await db.query(
      revenueQuery,
      userId ? [startOfYear, startOfMonth, startOfWeek, userId] : [startOfYear, startOfMonth, startOfWeek]
    );
    
    // Hours tracked
    const hoursQuery = `
      SELECT 
        SUM(CASE WHEN te.date >= $1 THEN te.hours ELSE 0 END) as hours_ytd,
        SUM(CASE WHEN te.date >= $2 THEN te.hours ELSE 0 END) as hours_mtd,
        SUM(CASE WHEN te.date >= $3 THEN te.hours ELSE 0 END) as hours_wtd,
        SUM(te.hours) as hours_all_time,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = false THEN te.hours ELSE 0 END) as non_billable_hours,
        AVG(CASE WHEN te.is_billable = true THEN te.hours ELSE NULL END) as avg_daily_billable
      FROM time_entries te
      WHERE te.status != 'draft'
      ${userId ? 'AND te.user_id = $4' : ''}
    `;
    
    const hoursResult = await db.query(
      hoursQuery,
      userId ? [startOfYear, startOfMonth, startOfWeek, userId] : [startOfYear, startOfMonth, startOfWeek]
    );
    
    // Active clients and projects
    const clientsProjectsQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as active_clients,
        COUNT(DISTINCT p.id) as active_projects,
        COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects_current
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      WHERE c.is_active = true
      ${userId ? `AND EXISTS (
        SELECT 1 FROM time_entries te2 
        JOIN projects p2 ON te2.project_id = p2.id 
        WHERE p2.client_id = c.id AND te2.user_id = $1
      )` : ''}
    `;
    
    const clientsProjectsResult = await db.query(
      clientsProjectsQuery,
      userId ? [userId] : []
    );
    
    // Average metrics
    const avgMetricsQuery = `
      SELECT 
        AVG(hourly_rate) as avg_hourly_rate,
        AVG(days_to_pay) as avg_days_to_payment
      FROM (
        SELECT 
          CASE 
            WHEN te.hours > 0 THEN COALESCE(p.hourly_rate, c.billing_rate, 175)
            ELSE COALESCE(p.hourly_rate, c.billing_rate, 175)
          END as hourly_rate,
          CASE 
            WHEN i.payment_status = 'paid' 
            THEN 30
            ELSE NULL
          END as days_to_pay
        FROM time_entries te
        JOIN projects p ON te.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        LEFT JOIN invoices i ON te.invoice_id = i.id
        WHERE te.is_billable = true
        AND te.hours > 0
        ${userId ? 'AND te.user_id = $1' : ''}
      ) as metrics
    `;
    
    const avgMetricsResult = await db.query(
      avgMetricsQuery,
      userId ? [userId] : []
    );
    
    // Invoice statistics
    const invoiceStatsQuery = `
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN payment_status = 'pending' AND status = 'sent' THEN 1 END) as pending_invoices,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_invoices,
        COUNT(CASE WHEN due_date < CURRENT_DATE AND payment_status != 'paid' THEN 1 END) as overdue_invoices
      FROM invoices
      ${userId ? 'WHERE created_by = $1' : ''}
    `;
    
    const invoiceStatsResult = await db.query(
      invoiceStatsQuery,
      userId ? [userId] : []
    );
    
    res.json({
      revenue: {
        allTime: parseFloat(revenueResult.rows[0].revenue_all_time) || 0,
        yearToDate: parseFloat(revenueResult.rows[0].revenue_ytd) || 0,
        monthToDate: parseFloat(revenueResult.rows[0].revenue_mtd) || 0,
        weekToDate: parseFloat(revenueResult.rows[0].revenue_wtd) || 0,
        collected: parseFloat(revenueResult.rows[0].revenue_collected) || 0,
        outstanding: parseFloat(revenueResult.rows[0].revenue_outstanding) || 0
      },
      hours: {
        allTime: parseFloat(hoursResult.rows[0].hours_all_time) || 0,
        yearToDate: parseFloat(hoursResult.rows[0].hours_ytd) || 0,
        monthToDate: parseFloat(hoursResult.rows[0].hours_mtd) || 0,
        weekToDate: parseFloat(hoursResult.rows[0].hours_wtd) || 0,
        billable: parseFloat(hoursResult.rows[0].billable_hours) || 0,
        nonBillable: parseFloat(hoursResult.rows[0].non_billable_hours) || 0,
        avgDailyBillable: parseFloat(hoursResult.rows[0].avg_daily_billable) || 0,
        utilizationRate: hoursResult.rows[0].hours_all_time > 0 
          ? ((parseFloat(hoursResult.rows[0].billable_hours) / parseFloat(hoursResult.rows[0].hours_all_time)) * 100).toFixed(1)
          : 0
      },
      clients: {
        active: parseInt(clientsProjectsResult.rows[0].active_clients) || 0,
        projects: parseInt(clientsProjectsResult.rows[0].active_projects) || 0,
        activeProjects: parseInt(clientsProjectsResult.rows[0].active_projects_current) || 0
      },
      averages: {
        hourlyRate: parseFloat(avgMetricsResult.rows[0].avg_hourly_rate) || 0,
        daysToPayment: parseFloat(avgMetricsResult.rows[0].avg_days_to_payment) || 0
      },
      invoices: {
        total: parseInt(invoiceStatsResult.rows[0].total_invoices) || 0,
        paid: parseInt(invoiceStatsResult.rows[0].paid_invoices) || 0,
        pending: parseInt(invoiceStatsResult.rows[0].pending_invoices) || 0,
        draft: parseInt(invoiceStatsResult.rows[0].draft_invoices) || 0,
        overdue: parseInt(invoiceStatsResult.rows[0].overdue_invoices) || 0
      }
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to fetch overview statistics' });
  }
};

const getRevenueOverTime = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate, includeUnbilled = 'false' } = req.query;
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    let dateFormat, interval;
    switch (period) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        interval = '1 day';
        break;
      case 'week':
        // Use week start date instead of ISO week number for clearer display
        dateFormat = 'YYYY-MM-DD';
        interval = '1 week';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        interval = '1 month';
        break;
      case 'quarter':
        dateFormat = 'YYYY-Q';
        interval = '3 months';
        break;
      case 'year':
        dateFormat = 'YYYY';
        interval = '1 year';
        break;
      default:
        dateFormat = 'YYYY-MM';
        interval = '1 month';
    }
    
    // Query for both invoiced and unbilled revenue by client
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('${period}', ${startDate ? '$1::date' : 'CURRENT_DATE - INTERVAL \'12 months\''}),
          DATE_TRUNC('${period}', ${endDate ? '$2::date' : 'CURRENT_DATE'}),
          '${interval}'::interval
        )::date AS period_date
      ),
      -- Invoiced revenue by client (calculating from hours * rate)
      invoiced_revenue AS (
        SELECT 
          DATE_TRUNC('${period}', te.date)::date as period_date,
          c.id as client_id,
          c.name as client_name,
          SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as revenue
        FROM time_entries te
        JOIN projects p ON te.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        WHERE te.invoice_id IS NOT NULL
        AND te.is_billable = true
        AND (te.is_deleted = false OR te.is_deleted IS NULL)
        ${startDate ? 'AND te.date >= $1' : ''}
        ${endDate ? 'AND te.date <= $2' : ''}
        ${userId ? `AND te.user_id = $${startDate && endDate ? '3' : startDate || endDate ? '2' : '1'}` : ''}
        GROUP BY DATE_TRUNC('${period}', te.date), c.id, c.name
      ),
      -- Unbilled revenue by client (calculating from hours * rate)
      unbilled_revenue AS (
        SELECT 
          DATE_TRUNC('${period}', te.date)::date as period_date,
          c.id as client_id,
          c.name as client_name,
          SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as revenue
        FROM time_entries te
        JOIN projects p ON te.project_id = p.id
        JOIN clients c ON p.client_id = c.id
        WHERE te.invoice_id IS NULL
        AND te.is_billable = true
        AND (te.is_deleted = false OR te.is_deleted IS NULL)
        ${startDate ? 'AND te.date >= $1' : ''}
        ${endDate ? 'AND te.date <= $2' : ''}
        ${userId ? `AND te.user_id = $${startDate && endDate ? '3' : startDate || endDate ? '2' : '1'}` : ''}
        GROUP BY DATE_TRUNC('${period}', te.date), c.id, c.name
      ),
      -- Combined data
      all_revenue AS (
        SELECT period_date, client_id, client_name, revenue, 'invoiced' as type FROM invoiced_revenue
        UNION ALL
        SELECT period_date, client_id, client_name, revenue, 'unbilled' as type FROM unbilled_revenue WHERE ${includeUnbilled === 'true'}
      ),
      -- Get top clients
      top_clients AS (
        SELECT client_id, client_name, SUM(revenue) as total_revenue
        FROM all_revenue
        GROUP BY client_id, client_name
        ORDER BY total_revenue DESC
        LIMIT 5
      )
      SELECT 
        TO_CHAR(ds.period_date, '${dateFormat}') as period,
        CASE 
          WHEN '${period}' = 'week' THEN 'Week of ' || TO_CHAR(ds.period_date, 'Mon DD')
          ELSE TO_CHAR(ds.period_date, '${dateFormat}')
        END as period_label,
        ds.period_date,
        COALESCE(c.client_id::text, '0') as client_id,
        COALESCE(c.client_name, 'Other') as client_name,
        COALESCE(SUM(ar.revenue), 0) as revenue,
        COALESCE(ar.type, 'invoiced') as revenue_type
      FROM date_series ds
      CROSS JOIN (
        SELECT client_id::text, client_name FROM top_clients
        UNION SELECT '0', 'Other'
      ) c
      LEFT JOIN all_revenue ar ON ds.period_date = ar.period_date 
        AND (ar.client_id::text = c.client_id OR (c.client_id = '0' AND ar.client_id NOT IN (SELECT client_id FROM top_clients)))
      GROUP BY ds.period_date, c.client_id, c.client_name, ar.type
      ORDER BY ds.period_date, c.client_name
    `;
    
    const params = [];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    if (userId) params.push(userId);
    
    const result = await db.query(query, params);
    
    // Debug logging
    console.log('Revenue over time query returned', result.rows.length, 'rows');
    console.log('Date range:', startDate || 'no start', 'to', endDate || 'no end');
    console.log('Sample rows:', result.rows.slice(0, 5));
    
    // Transform data for stacked chart by client
    const periods = [...new Set(result.rows.map(row => row.period))];
    const clients = [...new Set(result.rows.map(row => row.client_name))].filter(c => c !== 'Other');
    clients.push('Other'); // Put 'Other' at the end
    
    const revenueByClient = {};
    clients.forEach(client => {
      revenueByClient[client] = {
        invoiced: new Array(periods.length).fill(0),
        unbilled: new Array(periods.length).fill(0),
        total: new Array(periods.length).fill(0)
      };
    });
    
    result.rows.forEach(row => {
      const periodIndex = periods.indexOf(row.period);
      if (periodIndex !== -1) {
        const revenue = parseFloat(row.revenue);
        if (row.revenue_type === 'invoiced') {
          revenueByClient[row.client_name].invoiced[periodIndex] = revenue;
        } else {
          revenueByClient[row.client_name].unbilled[periodIndex] = revenue;
        }
        revenueByClient[row.client_name].total[periodIndex] += revenue;
      }
    });
    
    // Use period_label for display if available
    const periodLabels = [...new Set(result.rows.map(row => row.period_label || row.period))];
    
    res.json({
      periods: period === 'week' ? periodLabels : periods,
      clients,
      revenueByClient,
      totalRevenue: periods.map((_, idx) => 
        clients.reduce((sum, client) => sum + revenueByClient[client].total[idx], 0)
      ),
      invoicedRevenue: periods.map((_, idx) => 
        clients.reduce((sum, client) => sum + revenueByClient[client].invoiced[idx], 0)
      ),
      unbilledRevenue: periods.map((_, idx) => 
        clients.reduce((sum, client) => sum + revenueByClient[client].unbilled[idx], 0)
      )
    });
  } catch (error) {
    console.error('Get revenue over time error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
};

const getHoursOverTime = async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    let dateFormat, interval;
    switch (period) {
      case 'day':
        dateFormat = 'YYYY-MM-DD';
        interval = '1 day';
        break;
      case 'week':
        dateFormat = 'YYYY-WW';
        interval = '1 week';
        break;
      case 'month':
        dateFormat = 'YYYY-MM';
        interval = '1 month';
        break;
      default:
        dateFormat = 'YYYY-MM';
        interval = '1 month';
    }
    
    const query = `
      WITH date_series AS (
        SELECT generate_series(
          DATE_TRUNC('${period}', ${startDate ? '$1::date' : 'CURRENT_DATE - INTERVAL \'12 months\''}),
          DATE_TRUNC('${period}', ${endDate ? '$2::date' : 'CURRENT_DATE'}),
          '${interval}'::interval
        )::date AS period_date
      ),
      hours_data AS (
        SELECT 
          DATE_TRUNC('${period}', te.date)::date as period_date,
          SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
          SUM(CASE WHEN te.is_billable = false THEN te.hours ELSE 0 END) as non_billable_hours,
          SUM(te.hours) as total_hours,
          COUNT(DISTINCT te.user_id) as user_count
        FROM time_entries te
        WHERE te.status != 'draft'
        ${startDate ? 'AND te.date >= $1' : ''}
        ${endDate ? 'AND te.date <= $2' : ''}
        ${userId ? `AND te.user_id = $${startDate && endDate ? '3' : startDate || endDate ? '2' : '1'}` : ''}
        GROUP BY DATE_TRUNC('${period}', te.date)
      )
      SELECT 
        TO_CHAR(ds.period_date, '${dateFormat}') as period,
        ds.period_date,
        COALESCE(hd.billable_hours, 0) as billable_hours,
        COALESCE(hd.non_billable_hours, 0) as non_billable_hours,
        COALESCE(hd.total_hours, 0) as total_hours,
        COALESCE(hd.user_count, 0) as user_count,
        CASE 
          WHEN COALESCE(hd.total_hours, 0) > 0 
          THEN ROUND((hd.billable_hours / hd.total_hours * 100)::numeric, 1)
          ELSE 0
        END as utilization_rate
      FROM date_series ds
      LEFT JOIN hours_data hd ON ds.period_date = hd.period_date
      ORDER BY ds.period_date
    `;
    
    const params = [];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    if (userId) params.push(userId);
    
    const result = await db.query(query, params);
    
    res.json({
      periods: result.rows.map(row => row.period),
      billableHours: result.rows.map(row => parseFloat(row.billable_hours)),
      nonBillableHours: result.rows.map(row => parseFloat(row.non_billable_hours)),
      totalHours: result.rows.map(row => parseFloat(row.total_hours)),
      utilizationRate: result.rows.map(row => parseFloat(row.utilization_rate)),
      data: result.rows
    });
  } catch (error) {
    console.error('Get hours over time error:', error);
    res.status(500).json({ error: 'Failed to fetch hours data' });
  }
};

const getClientAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    const query = `
      SELECT 
        c.id,
        c.name,
        c.code,
        COUNT(DISTINCT p.id) as project_count,
        COUNT(DISTINCT te.id) as entry_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue,
        SUM(CASE WHEN te.is_billable = true AND te.invoice_id IS NOT NULL THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as invoiced_revenue,
        SUM(CASE WHEN te.is_billable = true AND te.invoice_id IS NULL THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as unbilled_revenue,
        MAX(te.date) as last_activity,
        MIN(te.date) as first_activity,
        AVG(CASE WHEN te.hours > 0 AND te.is_billable = true THEN COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE NULL END) as avg_rate
      FROM clients c
      JOIN projects p ON c.id = p.client_id
      JOIN time_entries te ON p.id = te.project_id
      WHERE c.is_active = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ${startDate ? 'AND te.date >= $1' : ''}
      ${endDate ? 'AND te.date <= $2' : ''}
      ${userId ? `AND te.user_id = $${startDate && endDate ? '3' : startDate || endDate ? '2' : '1'}` : ''}
      GROUP BY c.id, c.name, c.code
      ORDER BY revenue DESC
      LIMIT $${userId ? (startDate && endDate ? '4' : startDate || endDate ? '3' : '2') : (startDate && endDate ? '3' : startDate || endDate ? '2' : '1')}
    `;
    
    const params = [];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    if (userId) params.push(userId);
    params.push(limit);
    
    const result = await db.query(query, params);
    
    // Get client growth data
    const growthQuery = `
      WITH monthly_data AS (
        SELECT 
          c.id,
          c.name,
          DATE_TRUNC('month', te.date) as month,
          SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as monthly_revenue
        FROM clients c
        JOIN projects p ON c.id = p.client_id
        JOIN time_entries te ON p.id = te.project_id
        WHERE c.is_active = true
        AND te.is_billable = true
        AND (te.is_deleted = false OR te.is_deleted IS NULL)
        ${userId ? 'AND te.user_id = $1' : ''}
        GROUP BY c.id, c.name, DATE_TRUNC('month', te.date)
      )
      SELECT 
        id,
        name,
        AVG(monthly_revenue) as avg_monthly_revenue,
        CASE 
          WHEN COUNT(*) > 1 
          THEN (LAST_VALUE(monthly_revenue) OVER (PARTITION BY id ORDER BY month) - 
                FIRST_VALUE(monthly_revenue) OVER (PARTITION BY id ORDER BY month)) / 
                NULLIF(FIRST_VALUE(monthly_revenue) OVER (PARTITION BY id ORDER BY month), 0) * 100
          ELSE 0
        END as growth_rate
      FROM monthly_data
      GROUP BY id, name, monthly_revenue, month
    `;
    
    const growthResult = await db.query(growthQuery, userId ? [userId] : []);
    
    res.json({
      clients: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        projectCount: parseInt(row.project_count),
        entryCount: parseInt(row.entry_count),
        totalHours: parseFloat(row.total_hours),
        billableHours: parseFloat(row.billable_hours),
        revenue: parseFloat(row.revenue),
        invoicedRevenue: parseFloat(row.invoiced_revenue),
        unbilledRevenue: parseFloat(row.unbilled_revenue),
        avgRate: parseFloat(row.avg_rate),
        lastActivity: row.last_activity,
        firstActivity: row.first_activity,
        utilizationRate: row.total_hours > 0 
          ? ((parseFloat(row.billable_hours) / parseFloat(row.total_hours)) * 100).toFixed(1)
          : 0
      })),
      growth: growthResult.rows
    });
  } catch (error) {
    console.error('Get client analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch client analytics' });
  }
};

const getProjectAnalytics = async (req, res) => {
  try {
    const { clientId, status } = req.query;
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    const query = `
      SELECT 
        p.id,
        p.name,
        p.code,
        p.status,
        p.budget_hours,
        p.budget_amount,
        c.name as client_name,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as revenue,
        COUNT(DISTINCT te.user_id) as team_size,
        MIN(te.date) as start_date,
        MAX(te.date) as last_activity,
        CASE 
          WHEN p.budget_hours > 0 
          THEN ROUND((SUM(te.hours) / p.budget_hours * 100)::numeric, 1)
          ELSE NULL
        END as budget_utilization,
        CASE 
          WHEN p.budget_amount > 0 
          THEN ROUND((SUM(CASE WHEN te.is_billable = true THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) / p.budget_amount * 100)::numeric, 1)
          ELSE NULL
        END as budget_consumption
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      LEFT JOIN time_entries te ON p.id = te.project_id AND (te.is_deleted = false OR te.is_deleted IS NULL)
      WHERE 1=1
      ${clientId ? 'AND p.client_id = $1' : ''}
      ${status ? `AND p.status = $${clientId ? '2' : '1'}` : ''}
      ${userId ? `AND (te.user_id = $${clientId && status ? '3' : clientId || status ? '2' : '1'} OR te.user_id IS NULL)` : ''}
      GROUP BY p.id, p.name, p.code, p.status, p.budget_hours, p.budget_amount, c.name
      ORDER BY revenue DESC
    `;
    
    const params = [];
    if (clientId) params.push(clientId);
    if (status) params.push(status);
    if (userId) params.push(userId);
    
    const result = await db.query(query, params);
    
    res.json({
      projects: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        status: row.status,
        clientName: row.client_name,
        budgetHours: parseFloat(row.budget_hours) || null,
        budgetAmount: parseFloat(row.budget_amount) || null,
        totalHours: parseFloat(row.total_hours) || 0,
        billableHours: parseFloat(row.billable_hours) || 0,
        revenue: parseFloat(row.revenue) || 0,
        teamSize: parseInt(row.team_size) || 0,
        startDate: row.start_date,
        lastActivity: row.last_activity,
        budgetUtilization: parseFloat(row.budget_utilization) || null,
        budgetConsumption: parseFloat(row.budget_consumption) || null,
        isOverBudget: row.budget_utilization > 100 || row.budget_consumption > 100
      }))
    });
  } catch (error) {
    console.error('Get project analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
};

const getInvoiceAnalytics = async (req, res) => {
  try {
    const userId = req.user.userTypeId === 1 ? null : req.user.id;
    
    // Aging report
    const agingQuery = `
      SELECT 
        CASE 
          WHEN CURRENT_DATE - due_date <= 0 THEN 'current'
          WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN 'overdue_30'
          WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN 'overdue_60'
          WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN 'overdue_90'
          ELSE 'overdue_90_plus'
        END as aging_bucket,
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_amount,
        AVG(CURRENT_DATE - due_date) as avg_days_overdue
      FROM invoices
      WHERE payment_status != 'paid'
      AND status = 'sent'
      ${userId ? 'AND created_by = $1' : ''}
      GROUP BY aging_bucket
    `;
    
    const agingResult = await db.query(agingQuery, userId ? [userId] : []);
    
    // Payment trends - group by invoice date since we don't have payment_date
    const paymentTrendsQuery = `
      SELECT 
        DATE_TRUNC('month', invoice_date) as month,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as invoices_paid,
        SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as amount_collected,
        30 as avg_days_to_payment
      FROM invoices
      WHERE status != 'draft'
      ${userId ? 'AND created_by = $1' : ''}
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month DESC
      LIMIT 12
    `;
    
    const paymentTrendsResult = await db.query(paymentTrendsQuery, userId ? [userId] : []);
    
    // Invoice status breakdown
    const statusQuery = `
      SELECT 
        status,
        payment_status,
        COUNT(*) as count,
        SUM(total_amount) as total_amount
      FROM invoices
      ${userId ? 'WHERE created_by = $1' : ''}
      GROUP BY status, payment_status
    `;
    
    const statusResult = await db.query(statusQuery, userId ? [userId] : []);
    
    res.json({
      aging: agingResult.rows.map(row => ({
        bucket: row.aging_bucket,
        invoiceCount: parseInt(row.invoice_count),
        totalAmount: parseFloat(row.total_amount),
        avgDaysOverdue: parseFloat(row.avg_days_overdue)
      })),
      paymentTrends: paymentTrendsResult.rows.map(row => ({
        month: row.month,
        invoicesPaid: parseInt(row.invoices_paid),
        amountCollected: parseFloat(row.amount_collected),
        avgDaysToPayment: parseFloat(row.avg_days_to_payment)
      })),
      statusBreakdown: statusResult.rows.map(row => ({
        status: row.status,
        paymentStatus: row.payment_status,
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      }))
    });
  } catch (error) {
    console.error('Get invoice analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice analytics' });
  }
};

const getConsultantAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const isAdmin = req.user.userTypeId === 1;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        ut.name as user_type,
        COUNT(DISTINCT te.date) as days_worked,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = false THEN te.hours ELSE 0 END) as non_billable_hours,
        AVG(te.hours) as avg_hours_per_entry,
        COUNT(DISTINCT te.project_id) as projects_worked,
        COUNT(DISTINCT p.client_id) as clients_served,
        MAX(te.date) as last_activity,
        CASE 
          WHEN SUM(te.hours) > 0 
          THEN ROUND((SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) / SUM(te.hours) * 100)::numeric, 1)
          ELSE 0
        END as utilization_rate
      FROM users u
      JOIN user_types ut ON u.user_type_id = ut.id
      LEFT JOIN time_entries te ON u.id = te.user_id
      LEFT JOIN projects p ON te.project_id = p.id
      WHERE u.is_active = true
      ${startDate ? 'AND te.date >= $1' : ''}
      ${endDate ? 'AND te.date <= $2' : ''}
      GROUP BY u.id, u.first_name, u.last_name, u.email, ut.name
      ORDER BY total_hours DESC
    `;
    
    const params = [];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    
    const result = await db.query(query, params);
    
    res.json({
      consultants: result.rows.map(row => ({
        id: row.id,
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
        userType: row.user_type,
        daysWorked: parseInt(row.days_worked) || 0,
        totalHours: parseFloat(row.total_hours) || 0,
        billableHours: parseFloat(row.billable_hours) || 0,
        nonBillableHours: parseFloat(row.non_billable_hours) || 0,
        avgHoursPerEntry: parseFloat(row.avg_hours_per_entry) || 0,
        projectsWorked: parseInt(row.projects_worked) || 0,
        clientsServed: parseInt(row.clients_served) || 0,
        lastActivity: row.last_activity,
        utilizationRate: parseFloat(row.utilization_rate) || 0
      }))
    });
  } catch (error) {
    console.error('Get consultant analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch consultant analytics' });
  }
};

const getMyProjectHours = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    
    const query = `
      SELECT 
        p.id,
        p.name,
        c.name as client_name,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = false THEN te.hours ELSE 0 END) as non_billable_hours,
        COUNT(DISTINCT te.date) as days_worked,
        MIN(te.date) as first_entry,
        MAX(te.date) as last_entry
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.user_id = $1
      AND te.status != 'draft'
      ${startDate ? 'AND te.date >= $2' : ''}
      ${endDate ? `AND te.date <= $${startDate ? '3' : '2'}` : ''}
      GROUP BY p.id, p.name, c.name
      ORDER BY total_hours DESC
    `;
    
    const params = [userId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    
    const result = await db.query(query, params);
    
    // Calculate totals
    const totalHours = result.rows.reduce((sum, row) => sum + parseFloat(row.total_hours), 0);
    const totalBillable = result.rows.reduce((sum, row) => sum + parseFloat(row.billable_hours), 0);
    
    res.json({
      projects: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        clientName: row.client_name,
        totalHours: parseFloat(row.total_hours),
        billableHours: parseFloat(row.billable_hours),
        nonBillableHours: parseFloat(row.non_billable_hours),
        daysWorked: parseInt(row.days_worked),
        firstEntry: row.first_entry,
        lastEntry: row.last_entry
      })),
      totalHours,
      totalBillable,
      billablePercentage: totalHours > 0 ? Math.round((totalBillable / totalHours) * 100) : 0
    });
  } catch (error) {
    console.error('Get my project hours error:', error);
    res.status(500).json({ error: 'Failed to fetch project hours' });
  }
};

const getMyPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user.id;
    
    const query = `
      SELECT 
        COUNT(DISTINCT te.date) as working_days,
        COUNT(te.id) as entries_count,
        SUM(te.hours) as total_hours,
        SUM(CASE WHEN te.is_billable = true THEN te.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN te.is_billable = false THEN te.hours ELSE 0 END) as non_billable_hours,
        COUNT(DISTINCT te.project_id) as projects_worked,
        COUNT(DISTINCT p.client_id) as clients_served,
        AVG(te.hours) as avg_hours_per_entry,
        MIN(te.date) as first_entry,
        MAX(te.date) as last_entry
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.user_id = $1
      AND te.status != 'draft'
      ${startDate ? 'AND te.date >= $2' : ''}
      ${endDate ? `AND te.date <= $${startDate ? '3' : '2'}` : ''}
    `;
    
    const params = [userId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);
    
    const result = await db.query(query, params);
    const data = result.rows[0];
    
    const totalHours = parseFloat(data.total_hours) || 0;
    const billableHours = parseFloat(data.billable_hours) || 0;
    const workingDays = parseInt(data.working_days) || 0;
    
    res.json({
      workingDays,
      entriesCount: parseInt(data.entries_count) || 0,
      totalHours,
      billableHours,
      nonBillableHours: parseFloat(data.non_billable_hours) || 0,
      projectsWorked: parseInt(data.projects_worked) || 0,
      clientsServed: parseInt(data.clients_served) || 0,
      avgHoursPerEntry: parseFloat(data.avg_hours_per_entry) || 0,
      avgDailyHours: workingDays > 0 ? (totalHours / workingDays) : 0,
      billablePercentage: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
      utilizationRate: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
      firstEntry: data.first_entry,
      lastEntry: data.last_entry
    });
  } catch (error) {
    console.error('Get my performance error:', error);
    res.status(500).json({ error: 'Failed to fetch performance data' });
  }
};

const getDiagnosticData = async (req, res) => {
  try {
    const { clientName } = req.query;
    
    // First, let's check entries before June 2025 (i.e., 2024 and earlier)
    const beforeJuneQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as total_amount,
        MIN(te.date) as earliest_date,
        MAX(te.date) as latest_date
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.date < '2025-06-01'
      AND te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
    `;
    
    const beforeJuneResult = await db.query(beforeJuneQuery);
    
    // Also check 2024 data specifically
    const year2024Query = `
      SELECT 
        COUNT(*) as count,
        SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as total_amount,
        MIN(te.date) as earliest_date,
        MAX(te.date) as latest_date
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.date >= '2024-01-01' AND te.date < '2025-01-01'
      AND te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
    `;
    
    const year2024Result = await db.query(year2024Query);
    
    // Get monthly breakdown
    const monthlyQuery = `
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        COUNT(*) as entry_count,
        SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as total_amount,
        COUNT(DISTINCT client_id) as client_count,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      WHERE te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month
    `;
    
    const monthlyResult = await db.query(monthlyQuery);
    
    // Check actual date range in database
    const dateRangeQuery = `
      SELECT 
        MIN(date) as earliest_date,
        MAX(date) as latest_date,
        COUNT(*) as total_entries,
        COUNT(DISTINCT TO_CHAR(date, 'YYYY')) as years_count,
        STRING_AGG(DISTINCT TO_CHAR(date, 'YYYY'), ', ' ORDER BY TO_CHAR(date, 'YYYY')) as years
      FROM time_entries
      WHERE is_billable = true
      AND (is_deleted = false OR is_deleted IS NULL)
    `;
    
    const dateRangeResult = await db.query(dateRangeQuery);
    
    // Get raw time entries data for diagnostics
    let query = `
      SELECT 
        te.id,
        te.date,
        te.hours,
        te.rate,
        te.amount,
        te.is_billable,
        te.status,
        te.invoice_id,
        p.name as project_name,
        p.hourly_rate as project_rate,
        c.name as client_name,
        c.billing_rate as client_rate,
        COALESCE(p.hourly_rate, c.billing_rate, 175) as calculated_rate,
        te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) as calculated_amount,
        EXTRACT(WEEK FROM te.date) as week_number,
        EXTRACT(YEAR FROM te.date) as year,
        DATE_TRUNC('week', te.date) as week_start
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      ${clientName ? "AND c.name = $1" : ""}
      ORDER BY te.date DESC
      LIMIT 100
    `;
    
    const params = clientName ? [clientName] : [];
    const entriesResult = await db.query(query, params);
    
    // Get aggregated data by week
    const weekQuery = `
      SELECT 
        DATE_TRUNC('week', te.date) as week_start,
        TO_CHAR(DATE_TRUNC('week', te.date), 'YYYY-MM-DD') as week_label,
        EXTRACT(WEEK FROM te.date) as week_number,
        c.name as client_name,
        COUNT(*) as entry_count,
        SUM(te.amount) as total_amount,
        SUM(te.hours) as total_hours,
        STRING_AGG(te.amount::text, ', ') as amounts
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      AND te.date >= CURRENT_DATE - INTERVAL '3 months'
      ${clientName ? "AND c.name = $1" : ""}
      GROUP BY DATE_TRUNC('week', te.date), EXTRACT(WEEK FROM te.date), c.name
      ORDER BY week_start DESC, total_amount DESC
    `;
    
    const weekResult = await db.query(weekQuery, params);
    
    // Get client totals
    const clientQuery = `
      SELECT 
        c.name as client_name,
        COUNT(*) as entry_count,
        SUM(te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175)) as total_revenue,
        SUM(CASE WHEN te.invoice_id IS NOT NULL THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as invoiced_revenue,
        SUM(CASE WHEN te.invoice_id IS NULL THEN te.hours * COALESCE(p.hourly_rate, c.billing_rate, 175) ELSE 0 END) as unbilled_revenue,
        MIN(te.date) as first_entry,
        MAX(te.date) as last_entry
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.is_billable = true
      AND (te.is_deleted = false OR te.is_deleted IS NULL)
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `;
    
    const clientResult = await db.query(clientQuery);
    
    res.json({
      dateRange: {
        earliestDate: dateRangeResult.rows[0].earliest_date,
        latestDate: dateRangeResult.rows[0].latest_date,
        totalEntries: parseInt(dateRangeResult.rows[0].total_entries),
        yearsCount: parseInt(dateRangeResult.rows[0].years_count),
        years: dateRangeResult.rows[0].years
      },
      beforeJune2025: {
        count: parseInt(beforeJuneResult.rows[0].count),
        totalAmount: parseFloat(beforeJuneResult.rows[0].total_amount || 0),
        earliestDate: beforeJuneResult.rows[0].earliest_date,
        latestDate: beforeJuneResult.rows[0].latest_date
      },
      year2024: {
        count: parseInt(year2024Result.rows[0].count),
        totalAmount: parseFloat(year2024Result.rows[0].total_amount || 0),
        earliestDate: year2024Result.rows[0].earliest_date,
        latestDate: year2024Result.rows[0].latest_date
      },
      monthlyBreakdown: monthlyResult.rows,
      entries: entriesResult.rows,
      weeklyData: weekResult.rows,
      clientTotals: clientResult.rows,
      summary: {
        totalEntries: entriesResult.rows.length,
        totalAmount: entriesResult.rows.reduce((sum, row) => sum + parseFloat(row.calculated_amount || 0), 0),
        uniqueWeeks: [...new Set(weekResult.rows.map(r => r.week_number))].length,
        uniqueClients: [...new Set(clientResult.rows.map(r => r.client_name))].length
      }
    });
  } catch (error) {
    console.error('Get diagnostic data error:', error);
    res.status(500).json({ error: 'Failed to fetch diagnostic data' });
  }
};

module.exports = {
  getOverviewStats,
  getRevenueOverTime,
  getHoursOverTime,
  getClientAnalytics,
  getProjectAnalytics,
  getInvoiceAnalytics,
  getConsultantAnalytics,
  getMyProjectHours,
  getMyPerformance,
  getDiagnosticData
};