import './assets/main.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashHistory, createRouter } from '@tanstack/react-router'
import { ToastProvider } from '@heroui/react/toast'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
})

const hashHistory = createHashHistory()
const router = createRouter({ routeTree, history: hashHistory })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastProvider placement="bottom end" />
    </QueryClientProvider>
  </StrictMode>
)
