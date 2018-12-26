import * as Navi from 'navi'
import React from 'react'
import { join } from 'path'
import { chunk, fromPairs } from 'lodash-es'
import BlogContext from '../BlogContext'
import BlogIndexPage from '../components/BlogIndexPage'
import BlogLayout from '../components/BlogLayout'
import BlogPostLayout from '../components/BlogPostLayout'
import posts from './posts'

// The blog's title as it appears in the layout header, and in the document
// <title> tag.
const BLOG_TITLE = 'create-react-blog'

// Sets the number of posts that'll appear on each index page.
const INDEX_PAGE_SIZE = 1

// Split the posts into a list of chunks of the given size, and
// then build index pages for each chunk.
let chunks = chunk(posts, INDEX_PAGE_SIZE)
let chunkPagePairs = chunks.map((chunk, i) => [
  '/' + (i + 1),
  async env => {
    // Get the blog's root pathname, as all index pages other than the first
    // one are mounted at `/pages/n`
    let blogPathname = i === 0 ? env.pathname : join(env.pathname, '../..')

    // Get metadata for all pages on this page
    let posts = await Promise.all(
      chunk.map(async post => {
        let href = join(blogPathname, 'posts', post.slug)
        return {
          href,
          route: await env.router.resolve(href, {
            // If you want to show the page content on the index page, set
            // this to true to be able to access it.
            withContent: false,
          }),
        }
      }),
    )

    // Only add a page number to the page title after the first index page.
    let pageTitle = BLOG_TITLE
    if (i > 0) {
      pageTitle += ` – page ${i}`
    }

    return Navi.createPage({
      title: pageTitle,
      getContent: () =>
        <BlogIndexPage
          pageNumber={i+1}
          pageCount={chunks.length}
          posts={posts}
        />
    })
  },
])

const pagesSwitch = Navi.createSwitch({
  getContent: env => {
    // Check if the current page is an index page by comparing the remaining
    // portion of the URL's pathname with the index page paths.
    let remainingPathname = env.url.pathname.replace(env.mountname, '')
    let isViewingIndex =
      remainingPathname === '/' ||
      /^\/page\/\d+$/.test(remainingPathname)

    // Wrap the current page's content with a React Context to pass global
    // configuration to the blog's components.
    return (
      <BlogContext.Provider value={{
        pathname: env.pathname || '/',
        title: BLOG_TITLE,
      }}>
        <BlogLayout isViewingIndex={isViewingIndex} />
      </BlogContext.Provider>
    )
  },

  paths: {
    // The blog's index pages go here. The first index page is mapped to the
    // root URL, with a redirect from "/page/1". Subsequent index pages are
    // mapped to "/page/n".
    '/': chunkPagePairs.shift()[1],
    '/page': Navi.createSwitch({
      paths: {
        '/1': env => Navi.createRedirect(join(env.pathname, '../..')),
        ...fromPairs(chunkPagePairs),
      },
    }),

    // Put posts under "/posts", so that they can be wrapped with a
    // "<BlogPostLayout />" that configures MDX and adds a post-specific layout.
    '/posts': Navi.createSwitch({
      content: <BlogPostLayout />,
    
      paths: fromPairs(
        posts.map(post => [
          '/' + post.slug,
          post.getPage,
        ]),
      ),
    }),

    // Miscellaneous pages can be added directly to the root switch.
    '/tags': () => import('./tags'),
    '/about': () => import('./about'),

    // Only the statically built copy of the RSS feed is intended to be opened,
    // but the content is fetched here.
    '/rss': Navi.createPage({
      getContent: env => env.router.resolveSiteMap('/', {
        withContent: true
      })
    }),
  },
})

export default pagesSwitch