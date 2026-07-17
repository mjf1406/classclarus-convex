import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_account/c/$classId/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/c/$classId/points',
      params: { classId: params.classId },
    })
  },
})
