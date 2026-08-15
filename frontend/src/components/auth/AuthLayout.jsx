export default function AuthLayout({ children, footer, illustration }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-800">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        
        {/* ---------------- LEFT SIDE: Illustration Only ---------------- */}
        <section className="hidden bg-brand lg:flex lg:items-center lg:justify-center p-8 xl:p-16">
          <div className="w-full max-w-lg flex items-center justify-center">
            {illustration ? (
              illustration
            ) : (
              /* Fallback if no custom illustration prop is passed */
              <img 
                src="/illustration.svg" 
                alt="Authentication Illustration" 
                className="w-full h-auto max-h-[500px] object-contain drop-shadow-xl"
              />
            )}
          </div>
        </section>

        {/* ---------------- RIGHT SIDE: Form Container ---------------- */}
        <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            {children}
            {footer && (
              <div className="mt-8 border-t border-slate-100 pt-6">
                {footer}
              </div>
            )}
          </div>
        </section>

      </div>
    </main>
  )
}