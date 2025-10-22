import { NextApiRequest, NextApiResponse } from 'next'
 
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': "no-store",
  })
  let i = 0
  while (i < 10) {
    res.write(`data: ${i}\n\n`)
    i++
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  res.end()
}