import { QueryClient } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'

export const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string,
)

const convexQueryClient = new ConvexQueryClient(convex)

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexQueryClient.queryFn(),
    },
  },
})

convexQueryClient.connect(queryClient)

export type RouterContext = {
  queryClient: QueryClient
}
