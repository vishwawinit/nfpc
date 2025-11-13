'use client'

import { useState, Suspense } from 'react'
import { DynamicWorkingDashboard } from '../components/pages/DynamicWorkingDashboard'
import { UserAttendanceReport } from '../components/pages/UserAttendanceReport'
import { UserWiseJourneyAttendance } from '../components/pages/UserWiseJourneyAttendance'
import { DailyStockSaleReport } from '../components/pages/DailyStockSaleReport'
import { StoreUserVisitReport } from '../components/pages/StoreUserVisitReport'
import { LowStockReport } from '../components/pages/LowStockReport'
import { LMTDSecondaryReport } from '../components/pages/LMTDSecondaryReport'
import { OGPReport } from '../components/pages/OGPReport'
import { AgeingReport } from '../components/pages/AgeingReport'
import { BroadcastReport } from '../components/pages/BroadcastReport'
import { CompetitionReport } from '../components/pages/CompetitionReport'
import { PlanogramReport } from '../components/pages/PlanogramReport'
import { POStatusReport } from '../components/pages/POStatusReport'
import { SamplingReport } from '../components/pages/SamplingReport'
import { OSOIReport } from '../components/pages/OSOIReport'
import { ROTAReport } from '../components/pages/ROTAReport'
import { TargetReport } from '../components/pages/TargetReport'
import { CustomersReportUpdated as CustomersReport } from '../components/pages/CustomersReportUpdated'
import { ProductsReport } from '../components/pages/ProductsReport'
import { OrdersReport } from '../components/pages/OrdersReport'
import {
  Menu,
  LayoutDashboard,
  Package,
  Users,
  Radio,
  Calendar,
  Eye,
  FileText,
  ClipboardList,
  Grid,
  UserCheck,
  MapPin,
  Target,
  TrendingUp,
  AlertTriangle,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Store,
  BarChart3,
  ClipboardCheck,
  ShoppingCart
} from 'lucide-react'

type PageType =
  | 'dashboard'
  | 'dailyStockSale'
  | 'storeUserVisit'
  | 'broadcastInitiative'
  | 'ageingReport'
  | 'competitionObservation'
  | 'osoiReport'
  | 'planogramReport'
  | 'poStatusReport'
  | 'userJourneyAttendance'
  | 'samplingReport'
  | 'targetAchievement'
  | 'ogpReport'
  | 'lmtdSecondary'
  | 'lowStockCallout'
  | 'rotaActivity'
  | 'customersReport'
  | 'productsReport'
  | 'ordersReport'

interface MenuItem {
  id: PageType
  label: string
  icon: any
}

interface MenuCategory {
  id: string
  label: string
  icon: any
  items: MenuItem[]
}

function HomePageContent() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const menuCategories: MenuCategory[] = [
    {
      id: 'sales',
      label: 'Sales & Performance',
      icon: TrendingUp,
      items: [
        { id: 'dailyStockSale' as PageType, label: 'Daily Sales Report', icon: TrendingUp },
        { id: 'customersReport' as PageType, label: 'Customers Report', icon: Users },
        { id: 'targetAchievement' as PageType, label: 'Target Vs Achievement', icon: Target },
        { id: 'ogpReport' as PageType, label: 'OGP Report', icon: BarChart3 },
        { id: 'lmtdSecondary' as PageType, label: 'LMTD Secondary Sales Vs MTD', icon: BarChart3 },
      ]
    },
    {
      id: 'field',
      label: 'Field Operations',
      icon: Users,
      items: [
        { id: 'storeUserVisit' as PageType, label: 'Store User Visit Report', icon: MapPin },
        { id: 'userJourneyAttendance' as PageType, label: 'User Journey Attendance Reports', icon: UserCheck },
        { id: 'rotaActivity' as PageType, label: 'ROTA Activity', icon: Activity },
      ]
    },
    {
      id: 'inventory',
      label: 'Inventory & Stock',
      icon: Package,
      items: [
        { id: 'productsReport' as PageType, label: 'Products Report', icon: Package },
        { id: 'ordersReport' as PageType, label: 'Orders Report', icon: ShoppingCart },
        { id: 'lowStockCallout' as PageType, label: 'Low Stock Callout Report', icon: AlertTriangle },
      ]
    },
    {
      id: 'quality',
      label: 'Quality & Feedback',
      icon: ClipboardCheck,
      items: [
        { id: 'competitionObservation' as PageType, label: 'Competition Observation', icon: Eye },
        { id: 'samplingReport' as PageType, label: 'Sampling Report', icon: FileText },
      ]
    },
    {
      id: 'store',
      label: 'Store Management',
      icon: Store,
      items: [
        { id: 'planogramReport' as PageType, label: 'Planogram Report', icon: Grid },
        { id: 'osoiReport' as PageType, label: 'OSOI Report', icon: FileText },
        { id: 'broadcastInitiative' as PageType, label: 'Broadcast Initiative', icon: Radio },
      ]
    },
    {
      id: 'analytics',
      label: 'Reports & Analytics',
      icon: BarChart3,
      items: [
        { id: 'ageingReport' as PageType, label: 'Ageing Report New', icon: Calendar },
        { id: 'poStatusReport' as PageType, label: 'PO Status Report', icon: ClipboardList },
      ]
    },
  ]

  return (
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-gray-200 shadow-lg transition-all duration-300 ease-in-out ${
            sidebarExpanded ? 'w-80' : 'w-20'
          }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
            {sidebarExpanded && (
              <div className="flex items-center gap-3">
                <img
                  src="https://nfpcsfalive.winitsoftware.com/nfpcsfa-92/Img/logoNew1.jpg?v=2"
                  alt="NFPC Logo"
                  className="h-8 w-auto rounded-sm border border-gray-200 bg-white"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-800">
                    NFPC Analytics
                  </h1>
                  <p className="text-xs text-gray-500 mt-0.5">Reports Dashboard</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-all duration-200 ml-auto text-gray-600"
              title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>

          {/* Sidebar Menu */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {/* Dashboard - Always visible */}
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all duration-200 font-medium ${
                currentPage === 'dashboard'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={!sidebarExpanded ? 'Dashboard' : ''}
            >
              <LayoutDashboard size={20} className="flex-shrink-0" />
              {sidebarExpanded && (
                <span className="text-sm font-semibold">Dashboard</span>
              )}
            </button>

            {/* Divider */}
            {sidebarExpanded && (
              <div className="my-3 border-t border-gray-200"></div>
            )}

            {/* Categories */}
            {menuCategories.map((category) => {
              const CategoryIcon = category.icon
              const isExpanded = expandedCategories.includes(category.id)

              return (
                <div key={category.id} className="mb-1">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-gray-700 hover:bg-gray-100`}
                    title={!sidebarExpanded ? category.label : ''}
                  >
                    <CategoryIcon size={18} className="flex-shrink-0" />
                    {sidebarExpanded && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left">{category.label}</span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </>
                    )}
                  </button>

                  {/* Category Items - Show when expanded */}
                  {isExpanded && (
                    <div className={`mt-1 space-y-0.5 ${sidebarExpanded ? 'ml-4' : ''}`}>
                      {category.items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            className={`w-full flex items-center gap-3 ${
                              sidebarExpanded ? 'px-4' : 'px-2 justify-center'
                            } py-2.5 rounded-lg text-sm transition-all duration-200 ${
                              currentPage === item.id
                                ? 'bg-gray-200 text-gray-900 font-medium border-l-3 border-gray-800'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-3 border-transparent'
                            }`}
                            title={!sidebarExpanded ? item.label : ''}
                          >
                            <ItemIcon size={16} className="flex-shrink-0" />
                            {sidebarExpanded && <span className="truncate text-left">{item.label}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-600 text-center">
              {sidebarExpanded ? (
                <div>
                  <div className="font-semibold text-gray-800">
                    {new Date().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="mt-1 text-gray-500">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                </div>
              ) : (
                <div className="font-semibold text-gray-800">
                  {new Date().toLocaleDateString('en-US', { day: 'numeric' })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100"
        >
          <Menu size={24} />
        </button>

        {/* Mobile Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`md:hidden fixed left-0 top-0 bottom-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Mobile Sidebar Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <img
                src="https://nfpcsfalive.winitsoftware.com/nfpcsfa-92/Img/logoNew1.jpg?v=2"
                alt="NFPC Logo"
                className="h-8 w-auto rounded-sm border border-gray-200 bg-white"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  NFPC Analytics
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">Reports Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Menu Items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <button
              onClick={() => {
                setCurrentPage('dashboard')
                setMobileSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-lg transition-all font-medium ${
                currentPage === 'dashboard'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutDashboard size={20} className="flex-shrink-0" />
              <span className="text-sm font-semibold">Dashboard</span>
            </button>

            <div className="my-3 border-t border-gray-200"></div>

            {/* Mobile Categories */}
            {menuCategories.map((category) => {
              const CategoryIcon = category.icon
              const isExpanded = expandedCategories.includes(category.id)

              return (
                <div key={category.id} className="mb-1">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <CategoryIcon size={18} className="flex-shrink-0" />
                    <span className="text-sm font-medium flex-1 text-left">{category.label}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {category.items.map((item) => {
                        const ItemIcon = item.icon
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setCurrentPage(item.id)
                              setMobileSidebarOpen(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                              currentPage === item.id
                                ? 'bg-gray-200 text-gray-900 font-medium border-l-3 border-gray-800'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-3 border-transparent'
                            }`}
                          >
                            <ItemIcon size={16} className="flex-shrink-0" />
                            <span className="truncate text-left">{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          {currentPage === 'dashboard' && <DynamicWorkingDashboard />}
          {currentPage === 'dailyStockSale' && <DailyStockSaleReport />}
          {currentPage === 'storeUserVisit' && <StoreUserVisitReport />}
          {currentPage === 'broadcastInitiative' && <BroadcastReport />}
          {currentPage === 'ageingReport' && <AgeingReport />}
          {currentPage === 'competitionObservation' && <CompetitionReport />}
          {currentPage === 'osoiReport' && <OSOIReport />}
          {currentPage === 'planogramReport' && <PlanogramReport />}
          {currentPage === 'poStatusReport' && <POStatusReport />}
          {currentPage === 'userJourneyAttendance' && <UserWiseJourneyAttendance />}
          {currentPage === 'samplingReport' && <SamplingReport />}
          {currentPage === 'targetAchievement' && <TargetReport />}
          {currentPage === 'ogpReport' && <OGPReport />}
          {currentPage === 'lmtdSecondary' && <LMTDSecondaryReport />}
          {currentPage === 'lowStockCallout' && <LowStockReport />}
          {currentPage === 'rotaActivity' && <ROTAReport />}
          {currentPage === 'customersReport' && <CustomersReport />}
          {currentPage === 'productsReport' && <ProductsReport />}
          {currentPage === 'ordersReport' && <OrdersReport />}
        </main>
      </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  )
}