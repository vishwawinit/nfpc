# KPI Database Schema Analysis

## Tables Used for KPI Calculations

Based on the KPI API (`/api/dashboard/kpi/route.ts`), the following tables are used:

### 1. `flat_transactions` (Primary Data Table)

**Columns Used in KPI Calculations:**
- `transaction_date` - Date of the transaction (for date filtering)
- `net_amount` - Net sales amount (main KPI calculation)
- `transaction_code` - Unique transaction identifier (for counting orders)
- `customer_code` - Customer identifier (for unique customer count and joins)
- `quantity_bu` - Quantity in base units (for units sold KPI)
- `currency_code` - Currency code (defaults to 'AED')
- `user_code` - User who created the transaction (for user filtering)

**SQL Queries:**
```sql
-- Current Period KPI Query
SELECT
  COALESCE(SUM(t.net_amount), 0) as total_sales,
  COUNT(DISTINCT t.transaction_code) as total_orders,
  COUNT(DISTINCT t.customer_code) as unique_customers,
  COALESCE(SUM(t.quantity_bu), 0) as total_quantity,
  COALESCE(MAX(t.currency_code), 'AED') as currency_code
FROM flat_transactions t
LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
WHERE [date and filter conditions]
```

### 2. `flat_customers_master` (Filter Data Table)

**Columns Used for Filtering:**
- `customer_code` - Primary key for joining with transactions
- `state` - State/Region for geographic filtering
- `city` - City for geographic filtering  
- `sales_person_code` - Sales person assigned (for team leader and field user role filtering)
- `customer_type` - Customer type/chain for business filtering

**Filter Applications:**
```sql
-- Region Filter
WHERE c.state = $regionCode

-- City Filter  
WHERE c.city = $cityCode

-- Team Leader Filter
WHERE c.sales_person_code = $teamLeaderCode

-- Field User Role Filter
WHERE c.sales_person_code = $fieldUserRole

-- Chain Filter
WHERE c.customer_type = $chainName

-- Store Filter (uses transaction table)
WHERE t.customer_code = $storeCode
```

## KPI Calculations

### 1. Sales KPI
- **Source**: `SUM(t.net_amount)`
- **Field**: `total_sales`
- **Description**: Total net sales amount for the period

### 2. Orders KPI
- **Source**: `COUNT(DISTINCT t.transaction_code)`
- **Field**: `total_orders`
- **Description**: Count of unique transactions/orders

### 3. Customers KPI
- **Source**: `COUNT(DISTINCT t.customer_code)`
- **Field**: `unique_customers`
- **Description**: Count of unique customers who made purchases

### 4. Units KPI
- **Source**: `SUM(t.quantity_bu)`
- **Field**: `total_quantity`
- **Description**: Total quantity sold in base units

### 5. Average Order Value
- **Calculation**: `total_sales / total_orders`
- **Description**: Average revenue per order

## Date Range Calculations

### Current Period
- Uses user-selected date range or preset (thisMonth, lastMonth, etc.)
- Date filtering: `t.transaction_date::date >= startDate AND t.transaction_date::date <= endDate`

### Previous Period (for % change)
- Calculated as same duration shifted back in time
- Example: If current is "This Month", previous is "Last Month"

### MTD (Month-to-Date)
- Always from 1st of current month to today
- Used for additional context

### YTD (Year-to-Date)  
- Always from 1st of current year to today
- Used for additional context

## Filter Combinations

All filters can be combined and applied to all queries:

```sql
WHERE 
  t.transaction_date::date >= $startDate 
  AND t.transaction_date::date <= $endDate
  AND c.state = $regionCode                    -- Optional
  AND c.city = $cityCode                      -- Optional  
  AND c.sales_person_code = $teamLeaderCode   -- Optional
  AND c.sales_person_code = $fieldUserRole    -- Optional
  AND t.user_code = $userCode                 -- Optional
  AND c.customer_type = $chainName            -- Optional
  AND t.customer_code = $storeCode            -- Optional
```

## Performance Considerations

### Recommended Indexes
```sql
-- For transaction queries
CREATE INDEX idx_transactions_date_customer ON flat_transactions(transaction_date, customer_code);
CREATE INDEX idx_transactions_user_date ON flat_transactions(user_code, transaction_date);

-- For customer filtering
CREATE INDEX idx_customers_state_city ON flat_customers_master(state, city);
CREATE INDEX idx_customers_salesperson ON flat_customers_master(sales_person_code);
CREATE INDEX idx_customers_type ON flat_customers_master(customer_type);
```

### Query Optimization
- All queries use `COALESCE()` to handle NULL values
- Date casting to `::date` ensures proper date comparisons
- LEFT JOIN used to include transactions even if customer data is missing
- Parameterized queries prevent SQL injection

## Data Quality Requirements

### Required Fields
- `flat_transactions.transaction_date` - Must not be NULL
- `flat_transactions.net_amount` - Should default to 0 if NULL
- `flat_transactions.customer_code` - Required for customer filtering

### Optional Fields
- `flat_customers_master.*` - Filters gracefully handle missing customer data
- `flat_transactions.currency_code` - Defaults to 'AED' if NULL

## Troubleshooting

### Common Issues
1. **No data returned** - Check date range and table data availability
2. **Filter not working** - Verify customer_code joins between tables
3. **Wrong currency** - Check currency_code field in transactions
4. **Missing geographic filters** - Verify state/city data in customers_master

### Debug Queries
```sql
-- Check data availability
SELECT 
  COUNT(*) as total_transactions,
  MIN(transaction_date) as earliest_date,
  MAX(transaction_date) as latest_date,
  COUNT(DISTINCT customer_code) as unique_customers
FROM flat_transactions;

-- Check customer master data
SELECT 
  COUNT(*) as total_customers,
  COUNT(DISTINCT state) as unique_states,
  COUNT(DISTINCT city) as unique_cities,
  COUNT(DISTINCT sales_person_code) as unique_salespeople
FROM flat_customers_master;
```
