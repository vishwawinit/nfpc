# KPI Filter System Verification Test Plan

## Overview
This document outlines comprehensive tests to verify that KPI components properly respond to filter changes and that filter cascading/dependency handling works correctly.

## Test Categories

### 1. Filter Cascading Tests

#### 1.1 Region Filter Cascade
**Test Steps:**
1. Open dashboard and ensure no filters are applied
2. Select a region filter
3. **Expected Result:** City, Team Leader, Field User Role, and User filters should be cleared
4. **Verification:** Check browser console for "Dashboard: Query params updated: regionCode=XXX"

#### 1.2 City Filter Cascade  
**Test Steps:**
1. Select a region, then select a city
2. Change the city to a different one
3. **Expected Result:** Team Leader, Field User Role, and User filters should be cleared
4. **Verification:** Console should show updated cityCode parameter

#### 1.3 Team Leader Filter Cascade
**Test Steps:**
1. Select region → city → team leader
2. Change the team leader
3. **Expected Result:** Field User Role and User filters should be cleared
4. **Verification:** teamLeaderCode parameter should update

#### 1.4 Field User Role Filter Cascade
**Test Steps:**
1. Select all filters up to field user role
2. Change the field user role
3. **Expected Result:** Only User filter should be cleared
4. **Verification:** fieldUserRole parameter should update

#### 1.5 Chain Filter Independence
**Test Steps:**
1. Select various geographic filters, then select a chain
2. Change the chain
3. **Expected Result:** Only Store filter should be cleared, geographic filters remain
4. **Verification:** chainName parameter should update, storeCode should be null

### 2. KPI Response Tests

#### 2.1 Real-time KPI Updates
**Test Steps:**
1. Note initial KPI values (Sales, Orders, Customers, Units, Avg Order Value)
2. Apply any single filter (e.g., select a region)
3. **Expected Result:** All KPI cards should update with new values within 2-3 seconds
4. **Verification:** 
   - Console shows "KPI Hook: Fetching with params: regionCode=XXX"
   - Console shows "KPI API Response Summary" with filtered data
   - KPI cards display different values

#### 2.2 Multiple Filter Application
**Test Steps:**
1. Apply multiple filters in sequence (region → city → team leader)
2. **Expected Result:** KPIs should update after each filter change
3. **Verification:** Each filter change triggers new API call with cumulative parameters

#### 2.3 Date Range Impact
**Test Steps:**
1. Change date range from "This Month" to "Last Month"
2. Apply geographic filters
3. **Expected Result:** KPIs should reflect both date range and geographic filters
4. **Verification:** API calls include both range and filter parameters

#### 2.4 Filter Reset Functionality
**Test Steps:**
1. Apply multiple filters and note KPI values
2. Click "Reset All Filters" button
3. **Expected Result:** KPIs should return to unfiltered values
4. **Verification:** Console shows API call with only range parameter

### 3. Performance Tests

#### 3.1 Rapid Filter Changes
**Test Steps:**
1. Rapidly change filters multiple times within 5 seconds
2. **Expected Result:** No duplicate API calls, latest filter state is applied
3. **Verification:** Console doesn't show excessive API calls

#### 3.2 Large Dataset Filtering
**Test Steps:**
1. Apply filters that result in large datasets
2. Apply filters that result in small datasets  
3. **Expected Result:** KPIs load within reasonable time (< 5 seconds)
4. **Verification:** No timeout errors or infinite loading states

### 4. Error Handling Tests

#### 4.1 Network Failure Recovery
**Test Steps:**
1. Disconnect network
2. Apply a filter
3. **Expected Result:** Error message appears with retry button
4. Reconnect network and click retry
5. **Verification:** KPIs load successfully after retry

#### 4.2 Invalid Filter Values
**Test Steps:**
1. Manually modify URL with invalid filter parameters
2. **Expected Result:** System gracefully handles invalid values, shows default data
3. **Verification:** No JavaScript errors in console

### 5. Console Log Verification

When testing, ensure these console logs appear:

#### Dashboard Level:
```
Dashboard: Query params updated: [parameters]
```

#### Hook Level:  
```
KPI Hook: Fetching with params: [full_query_string]
KPI Hook: Successfully fetched data: {currentSales: X, dateRange: Y, hasFilters: true/false}
```

#### API Level:
```
KPI API called with params: [parameters]
Applied [filter_name] filter: [value]
KPI API Response Summary: {dateRange, currentSales, salesChange, startDate, endDate}
```

## Expected Filter Flow

```
User Changes Filter → DashboardFilters Component
          ↓
useDashboardFilters Hook (updateFilter with cascading)
          ↓  
getQueryParams() generates URLSearchParams
          ↓
DynamicWorkingDashboard useMemo triggers (dependency array)
          ↓
DynamicKPICards receives new additionalParams
          ↓
useDashboardKPI hook detects param changes (paramsString dependency)
          ↓
fetchData() called with new parameters
          ↓
/api/dashboard/kpi called with filters applied
          ↓
KPI cards update with filtered data
```

## Pass Criteria

✅ **All filter cascading works as expected**  
✅ **KPI values change when filters are applied**  
✅ **Console logs confirm proper parameter flow**  
✅ **No JavaScript errors or infinite loops**  
✅ **Performance is acceptable (< 5 second response times)**  
✅ **Error states display and recovery works**  
✅ **Reset functionality clears all filters and restores original KPIs**

## Debugging Commands

Open browser console and run these commands during testing:

```javascript
// Check current filter state
console.log(window.location.search)

// Monitor KPI updates
window.addEventListener('fetch', (e) => {
  if (e.detail && e.detail.url.includes('/api/dashboard/kpi')) {
    console.log('KPI API Called:', e.detail.url)
  }
})
```

## Common Issues to Watch For

1. **Missing cityCode dependency** - Fixed in DynamicWorkingDashboard.tsx
2. **Parameter memoization issues** - Fixed in DynamicKPICards.tsx  
3. **Redundant useEffect dependencies** - Fixed in useDataService.ts
4. **Missing fieldUserRole in MTD/YTD** - Fixed in KPI API
5. **Filter not clearing dependent filters** - Check cascading logic
6. **KPIs not updating after filter change** - Check console logs for parameter flow
