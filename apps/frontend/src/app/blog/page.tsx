"use client";

import { useEffect, useState } from 'react'
import { getDb } from '@/lib/firebase/client'
import { collection, getDocs, orderBy, limit, query } from 'firebase/firestore'

type Post = { id: string; title: string; summary: string; content?: string; publishedAt: string }

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const db = getDb()
        const q = query(collection(db, 'blog_posts'), orderBy('publishedAt', 'desc'), limit(20))
        const snap = await getDocs(q)
        const rows: Post[] = []
        snap.forEach((doc) => {
          const d = doc.data() as any
          rows.push({ id: doc.id, title: d.title, summary: d.summary, content: d.content, publishedAt: d.publishedAt })
        })
        setPosts(rows)
      } catch (e: any) {
        setError(e?.message || '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">From the blog</h2>
          <p className="mt-2 text-lg leading-8 text-gray-600">Learn how to grow your business with our expert advice.</p>
        </div>
        {loading ? (
          <p className="mt-10 text-center text-gray-500">加载中...</p>
        ) : error ? (
          <p className="mt-10 text-center text-red-500">{error}</p>
        ) : (
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {posts.map((post) => (
              <article key={post.id} className="flex max-w-xl flex-col items-start justify-between">
                <div className="flex items-center gap-x-4 text-xs">
                  <time dateTime={post.publishedAt} className="text-gray-500">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </time>
                </div>
                <div className="group relative">
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                    <a href={`#`}>
                      <span className="absolute inset-0" />
                      {post.title}
                    </a>
                  </h3>
                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">{post.summary}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
