import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/s/$schoolId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/s/$schoolId/members',
      params: { schoolId: params.schoolId },
    })
  },
})
