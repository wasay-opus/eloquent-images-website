import { createElement, Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchBlogBySlug } from '../api/blogs.js';
import RemoteImage from '../components/RemoteImage.jsx';

const CONTENT_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h2',
  'h3',
  'h4',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'u',
  'ul',
]);

const CONTENT_CLASSES = new Set([
  'ql-align-center',
  'ql-align-justify',
  'ql-align-right',
  'ql-code-block',
  'ql-code-block-container',
  'ql-syntax',
]);

function getSafeClassName(node) {
  const className = node.getAttribute('class') || '';
  const safeClasses = className.split(/\s+/).filter(
    (name) => CONTENT_CLASSES.has(name) || /^ql-indent-[1-8]$/.test(name)
  );
  const listType = node.tagName === 'LI' ? node.getAttribute('data-list') : null;

  if (['bullet', 'ordered'].includes(listType)) {
    safeClasses.push(`ql-list-${listType}`);
  }

  return safeClasses.length > 0 ? safeClasses.join(' ') : undefined;
}

function getSafeLinkHref(href) {
  if (!href) return '#';

  try {
    const url = new URL(href, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : '#';
  } catch {
    return '#';
  }
}

function renderContentNode(node, key) {
  if (node.nodeType === 3) {
    return node.textContent;
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const tag = node.tagName.toLowerCase();

  if (tag === 'img') {
    return (
      <RemoteImage
        alt={node.getAttribute('alt') || 'Blog image'}
        className="blogDetail-inlineImg"
        decoding="async"
        key={key}
        loading="lazy"
        src={node.getAttribute('src')}
      />
    );
  }

  if (tag === 'br') {
    return createElement(tag, { key });
  }

  const children = [...node.childNodes].map((child, index) =>
    renderContentNode(child, `${key}-${index}`)
  );

  if (!CONTENT_TAGS.has(tag)) {
    return <Fragment key={key}>{children}</Fragment>;
  }

  const props = { key };
  const className = getSafeClassName(node);

  if (className) {
    props.className = className;
  }

  if (tag === 'li') {
    const listType = node.getAttribute('data-list');
    if (['bullet', 'ordered'].includes(listType)) {
      props['data-list'] = listType;
    }
  }

  if (tag === 'a') {
    props.href = getSafeLinkHref(node.getAttribute('href'));
    props.rel = 'noreferrer';
  }

  return createElement(tag, props, children);
}

function BlogContent({ html }) {
  const content = useMemo(() => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    return [...document.body.childNodes].map((node, index) =>
      renderContentNode(node, `content-${index}`)
    );
  }, [html]);

  return <div className="blogDetail-content">{content}</div>;
}

function BlogImages({ content, images, title }) {
  const contentImageSources = useMemo(() => {
    const document = new DOMParser().parseFromString(content, 'text/html');
    return new Set(
      [...document.querySelectorAll('img')]
        .map((image) => image.getAttribute('src'))
        .filter(Boolean)
    );
  }, [content]);

  const imagesAfterContent = images.filter(
    (image) => image.imageUrl && !contentImageSources.has(image.imageUrl)
  );

  if (imagesAfterContent.length === 0) return null;

  return (
    <div className="blogDetail-images">
      {imagesAfterContent.map((image, index) => (
        <RemoteImage
          alt={image.title || `${title} image ${index + 1}`}
          className="blogDetail-inlineImg"
          decoding="async"
          key={image.id || image.imageUrl}
          loading="lazy"
          src={image.imageUrl}
        />
      ))}
    </div>
  );
}

function BlogDetail() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();

    setPost(null);
    setStatus('loading');

    fetchBlogBySlug(slug, controller.signal)
      .then((requestedPost) => {
        setPost(requestedPost ?? null);
        setStatus(requestedPost ? 'ready' : 'not-found');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Unable to load blog article:', error);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, [slug]);

  if (status === 'loading' || status === 'error') {
    return (
      <section className="blogDetail">
        <div className="container">
          <div className="blog-status">
            {status === 'loading'
              ? 'Loading article...'
              : 'The article could not be loaded. Please try again later.'}
          </div>
        </div>
      </section>
    );
  }

  if (status === 'not-found' || !post) {
    return (
      <section className="blogDetail">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-10">
              <h1>Article Not Found</h1>
              <p>The article you are looking for is not available right now.</p>
              <Link to="/blogs">Back To Blogs</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="blogDetail">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-10">
            <RemoteImage
              alt={post.title}
              className="blogDetail-mainImg"
              decoding="async"
              fetchPriority="high"
              loading="eager"
              src={post.featuredImage}
            />
            <h1>{post.title}</h1>
            <BlogContent html={post.content} />
            <BlogImages content={post.content} images={post.images} title={post.title} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default BlogDetail;
