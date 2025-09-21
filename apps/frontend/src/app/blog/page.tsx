"use client";

const posts = [
  {
    title: "The Silent Killer of Your Brand Bid Campaigns",
    href: "#",
    description:
      "Why Low CTR is Costing You More Than You Think",
    date: "Mar 16, 2024",
    datetime: "2024-03-16",
  },
  {
    title: "Flying Blind: Are You Bidding on the Right Brand Offers?",
    href: "#",
    description:
      "A Data-Driven Approach to Affiliate Marketing",
    date: "Mar 10, 2024",
    datetime: "2024-03-10",
  },
  {
    title: "The Brand Bidder's Nightmare",
    href: "#",
    description:
      "How a Single Policy Violation Can Wipe Out Your Google Ads Empire",
    date: "Feb 28, 2024",
    datetime: "2024-02-28",
  },
];

export default function BlogPage() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            From the blog
          </h2>
          <p className="mt-2 text-lg leading-8 text-gray-600">
            Learn how to grow your business with our expert advice.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.title}
              className="flex max-w-xl flex-col items-start justify-between"
            >
              <div className="flex items-center gap-x-4 text-xs">
                <time dateTime={post.datetime} className="text-gray-500">
                  {post.date}
                </time>
              </div>
              <div className="group relative">
                <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                  <a href={post.href}>
                    <span className="absolute inset-0" />
                    {post.title}
                  </a>
                </h3>
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                  {post.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
