'use client'

export default function TestAccessPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Access Page</h1>
      <p className="mb-4">If you can see this page, the application is running correctly.</p>
      
      <div className="space-y-2">
        <p>✅ Application is accessible</p>
        <p>✅ Next.js is running</p>
        <p>✅ Routes are working</p>
      </div>
      
      <div className="mt-8 space-y-2">
        <h2 className="text-xl font-semibold">Test Links:</h2>
        <div className="space-x-4">
          <a href="/" className="text-blue-600 hover:underline">Go to Main Dashboard</a>
          <a href="/?userCode=admin" className="text-blue-600 hover:underline">Dashboard as Admin</a>
          <a href="/?userCode=TB1302" className="text-blue-600 hover:underline">Dashboard as TB1302</a>
        </div>
      </div>
    </div>
  )
}
