# KPI Troubleshooting Guide

## Issues Fixed

### 1. **AED 0 Problem Resolution**

**Root Causes Identified:**
- **Date Comparison Issue**: Using `::date` casting instead of `DATE()` function
- **Transaction Type Handling**: Not properly separating sales (trx_type=1) vs returns (trx_type=4)
- **Missing Net Amount Calculation**: Not subtracting returns from sales
- **No Caching**: Repeated expensive queries causing performance issues

### 2. **Optimizations Applied**

#### **Database Query Improvements:**
```sql
-- OLD (Problematic)
SELECT COALESCE(SUM(t.net_amount), 0) as total_sales
WHERE t.transaction_date::date >= ? AND t.transaction_date::date <= ?

-- NEW (Fixed)
SELECT 
  COALESCE(SUM(CASE WHEN t.trx_type = 1 THEN t.net_amount ELSE 0 END), 0) as total_sales,
  COALESCE(SUM(CASE WHEN t.trx_type = 4 THEN t.net_amount ELSE 0 END), 0) as return_sales,
  COALESCE(SUM(CASE WHEN t.trx_type = 1 THEN t.net_amount ELSE -t.net_amount END), 0) as net_sales
WHERE DATE(t.transaction_date) >= ? AND DATE(t.transaction_date) <= ?
```

#### **Smart Caching System:**
- **Today**: 5 minutes (frequently changing)
- **Yesterday**: 60 minutes (stable data)
- **This Month**: 60 minutes
- **Last Month**: 6 hours (historical, stable)
- **Last Quarter**: 12 hours (historical, very stable)
- **Custom Dates**: 15 minutes

#### **Performance Features:**
- **Intelligent Cache Keys**: Based on all parameters (date range + filters)
- **Cache Hit Logging**: Track cache performance
- **Stale-While-Revalidate**: Serve cached data while updating in background
- **Record Count Debugging**: Show how many records match filters

### 3. **Testing the Fix**

#### **Debug Information Added:**
1. **Console Logs**: Track every step of data processing
2. **Record Counts**: Verify how many transactions match your filters
3. **Filter Application**: See which filters are actually applied
4. **Cache Performance**: Monitor cache hits and misses

#### **Test with Your Data:**
Based on your sample data from 2025-09-11, you should now see:
- **Transaction Records**: > 0 (your data has records)
- **Total Sales**: Sum of net_amount for trx_type=1 transactions
- **Returns**: Sum of net_amount for trx_type=4 transactions  
- **Net Sales**: Sales minus Returns
- **Currency**: AED (from your data)

### 4. **Monitoring Commands**

#### **Check Database Records:**
```sql
-- Verify your data exists
SELECT 
  COUNT(*) as total_transactions,
  SUM(CASE WHEN trx_type = 1 THEN net_amount ELSE 0 END) as total_sales,
  SUM(CASE WHEN trx_type = 4 THEN net_amount ELSE 0 END) as returns,
  MIN(DATE(transaction_date)) as earliest_date,
  MAX(DATE(transaction_date)) as latest_date,
  COUNT(DISTINCT currency_code) as currencies
FROM flat_transactions 
WHERE DATE(transaction_date) >= '2025-09-01' 
  AND DATE(transaction_date) <= '2025-09-30';
```

#### **Test Specific Date Range:**
```sql
-- Test September 2025 data (your sample data)
SELECT 
  DATE(transaction_date) as date,
  COUNT(*) as transactions,
  SUM(net_amount) as total_amount,
  COUNT(DISTINCT customer_code) as customers
FROM flat_transactions 
WHERE DATE(transaction_date) = '2025-09-11'
GROUP BY DATE(transaction_date);
```

### 5. **Expected Results**

After the fix, when you call the KPI API, you should see in console:

```javascript
// Browser Console
KPI Hook: Fetching with params: range=thisMonth
Dashboard: Query params updated: range=thisMonth

// Server Console  
KPI API called with params: range=thisMonth
Date filter applied: {startDate: '2025-09-01', endDate: '2025-09-30', dateRange: 'thisMonth'}
Current period results: {
  totalRecords: 150, // > 0 means data found
  currentNetSales: 12345.67, // > 0 means calculation works
  currentNetOrders: 45,
  currentUniqueCustomers: 23,
  dateRange: 'thisMonth',
  currencyCode: 'AED'
}
```

### 6. **Common Issues & Solutions**

#### **Still Getting AED 0?**
1. **Check Date Range**: Ensure your data exists in the selected period
2. **Verify Filters**: Too restrictive filters might exclude all data
3. **Check Transaction Types**: Ensure trx_type=1 exists in your data
4. **Database Connection**: Verify the API can connect to your database

#### **Performance Issues?**
1. **Monitor Cache**: Check console for "Cache HIT" vs cache misses
2. **Database Indexes**: Ensure proper indexes on transaction_date and customer_code
3. **Connection Pool**: Verify database pool settings in environment variables

#### **Filter Not Working?**
1. **Check Join**: Verify flat_customers_master has data matching your transactions
2. **Field Names**: Ensure filter field names match your database schema
3. **Parameter Passing**: Check that frontend passes filters correctly

### 7. **Performance Monitoring**

#### **Cache Performance:**
```javascript
// Console will show:
KPI Cache HIT for key: range=thisMonth&regionCode=UAE
KPI Cache SET for key: range=lastMonth, TTL: 360min
KPI Cache EXPIRED for key: range=today
```

#### **Database Performance:**
- **Query Execution Time**: Monitor slow queries
- **Connection Pool**: Watch for connection exhaustion
- **Index Usage**: Ensure DATE(transaction_date) uses indexes

### 8. **Data Quality Checks**

#### **Verify Transaction Data:**
```sql
SELECT 
  trx_type,
  trx_type_name,
  COUNT(*) as count,
  SUM(net_amount) as total_amount
FROM flat_transactions 
GROUP BY trx_type, trx_type_name
ORDER BY trx_type;
```

#### **Check Customer Master Join:**
```sql
SELECT 
  COUNT(t.*) as total_transactions,
  COUNT(c.*) as transactions_with_customers,
  COUNT(*) - COUNT(c.*) as orphaned_transactions
FROM flat_transactions t
LEFT JOIN flat_customers_master c ON t.customer_code = c.customer_code
WHERE DATE(t.transaction_date) >= '2025-09-01';
```

## Summary

The optimized KPI API now:
✅ **Correctly handles transaction types** (sales vs returns)  
✅ **Uses proper date functions** for accurate filtering  
✅ **Implements intelligent caching** for performance  
✅ **Provides debug information** for troubleshooting  
✅ **Supports all filter combinations** with proper SQL  
✅ **Returns actual data** instead of AED 0  

Your transaction data from September 11, 2025 should now display correctly with proper sales amounts, order counts, and customer metrics.
