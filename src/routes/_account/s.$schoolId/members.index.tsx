import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/s/$schoolId/members/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/s/$schoolId/admins',
      params: { schoolId: params.schoolId },
    })
  },
})
