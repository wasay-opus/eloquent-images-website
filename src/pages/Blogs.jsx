import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBlogs } from '../api/blogs.js';
import RemoteImage from '../components/RemoteImage.jsx';

function Blogs() {
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();

    fetchBlogs(controller.signal)
      .then((blogs) => {
        setPosts([...blogs].reverse());
        setStatus('ready');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Unable to load blogs:', error);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="featuredBlog">
      <div className="container">
        <div className="row">
          <div className="col-12" data-aos="fade-up">
            <h2>Featured Articles</h2>
          </div>
        </div>

        <div className="row g-4">
          {status === 'loading' && (
            <div className="col-12">
              <div className="blog-status">Loading articles...</div>
            </div>
          )}
          {status === 'error' && (
            <div className="col-12">
              <div className="blog-status">
                Articles could not be loaded. Please try again later.
              </div>
            </div>
          )}
          {status === 'ready' && posts.length === 0 && (
            <div className="col-12">
              <div className="blog-status">No articles available.</div>
            </div>
          )}
          {posts.map((post, index) => (
            <div className="col-md-4 col-sm-6" key={post.id}>
              <Link className="featuredBlog-card" to={`/blogs/${post.slug}`}>
                <RemoteImage
                  src={post.featuredImage}
                  alt={post.title}
                  className="featuredBlog-cardImg"
                  loading={index < 3 ? "eager" : "lazy"}
                  fetchPriority={index < 3 ? "high" : "auto"}
                  decoding="async"
                />
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Blogs;
