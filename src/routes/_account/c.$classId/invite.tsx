import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/c/$classId/invite')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/c/$classId/members/invite',
      params: { classId: params.classId },
    })
  },
})
