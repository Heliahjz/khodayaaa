import {
  Product,
  ProductCategory,
  Post,
  PostCategory,
  SiteContent,
  SlugRedirect
} from '../types';

/**
 * Generates a URL-safe, SEO-friendly slug supporting both Latin and Persian characters,
 * while preferring clean ASCII hyphenated slugs when provided.
 */
export function sanitizeSlug(input: string, fallbackPrefix = 'item', fallbackId?: number | string): string {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '-') // zero-width space / ZWNJ to hyphen
    .replace(/[_\s/\\]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (raw.length >= 2) {
    return raw.slice(0, 120);
  }
  return `${fallbackPrefix}-${fallbackId ?? Date.now()}`;
}

/**
 * Ensures uniqueness of a slug within a list of entities (excluding the entity being edited).
 */
export function isSlugDuplicate<T extends { id: number; slug: string; isDelete?: boolean }>(
  items: T[],
  candidateSlug: string,
  excludeId?: number
): boolean {
  const normalized = sanitizeSlug(candidateSlug);
  return items.some(
    (item) =>
      !item.isDelete &&
      item.id !== excludeId &&
      sanitizeSlug(item.slug) === normalized
  );
}

/**
 * Resolves the canonical origin cleanly without inventing domains.
 * Uses configured productionUrl if explicitly set by the store owner,
 * or process.env.APP_URL on server, or window.location.origin in browser.
 */
export function resolveSiteOrigin(
  siteContent?: SiteContent | null,
  reqOrigin?: string
): string {
  const customDomain = siteContent?.seoConfig?.productionDomain?.trim();
  if (customDomain && /^https?:\/\//i.test(customDomain)) {
    return customDomain.replace(/\/+$/, '');
  }
  if (reqOrigin && /^https?:\/\//i.test(reqOrigin)) {
    return reqOrigin.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return '';
}

export interface ResolvedPageSeo {
  status: 200 | 301 | 404;
  redirectTo?: string;
  title: string;
  description: string;
  canonicalPath: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'product' | 'article';
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt: string;
  jsonLd: Record<string, any>[];
  semanticHtml: string;
  routeType:
    | 'home'
    | 'product'
    | 'category'
    | 'articles'
    | 'article'
    | 'consultation'
    | 'about'
    | 'contact'
    | 'tracking'
    | 'checkout'
    | 'admin'
    | 'terms'
    | 'refund'
    | 'not_found';
  matchedProduct?: Product;
  matchedCategory?: ProductCategory;
  matchedPost?: Post;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildOrganizationJsonLd(origin: string, siteContent?: SiteContent | null) {
  const brandName = siteContent?.brandName || 'اونیوال';
  const brandEng = siteContent?.brandEnglishName || 'ONIVAL';
  const logoUrl =
    siteContent?.siteLogo && siteContent.siteLogo.startsWith('http')
      ? siteContent.siteLogo
      : `${origin}/favicon.svg`;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': `${origin}/#organization`,
    name: `${brandName} | ${brandEng}`,
    alternateName: brandEng,
    url: `${origin}/`,
    description:
      siteContent?.brandDescription ||
      siteContent?.heroSubtitle ||
      'فروشگاه تخصصی عسل طبیعی، ژل رویال، گرده گل و فرآورده‌های ارگانیک کوهستان اونیوال',
  };

  if (siteContent?.siteLogo && siteContent.siteLogo.startsWith('http')) {
    schema.logo = logoUrl;
  }
  if (siteContent?.contactPhone) {
    schema.telephone = siteContent.contactPhone;
  }
  if (siteContent?.contactEmail) {
    schema.email = siteContent.contactEmail;
  }
  if (siteContent?.contactAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: siteContent.contactAddress,
      addressCountry: 'IR',
    };
  }
  return schema;
}

export function buildBreadcrumbJsonLd(
  origin: string,
  items: { name: string; path: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `${origin}${item.path.startsWith('/') ? item.path : `/${item.path}`}`,
    })),
  };
}

export function buildProductJsonLd(
  origin: string,
  product: Product,
  siteContent?: SiteContent | null
) {
  const brandName = product.brand?.trim() || siteContent?.brandName || 'اونیوال';
  const discount = Number(product.discount ?? product.discountPercent ?? 0) || 0;
  const basePrice =
    product.sizes && product.sizes.length > 0
      ? product.sizes[0].price
      : Number(product.price) || 0;
  const finalPrice =
    discount > 0 ? Math.round((basePrice * (100 - discount)) / 100) : basePrice;

  const availabilityMap: Record<string, string> = {
    InStock: 'https://schema.org/InStock',
    OutOfStock: 'https://schema.org/OutOfStock',
    PreOrder: 'https://schema.org/PreOrder',
  };
  const schemaAvailability =
    availabilityMap[product.availability || 'InStock'] || 'https://schema.org/InStock';

  const productUrl = `${origin}/products/${encodeURIComponent(product.slug)}`;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.seoDescription || product.description || product.content,
    sku: product.sku || `ONV-PRD-${product.id}`,
    url: productUrl,
    category: product.categoryTitle || product.productCategoryTitle || 'محصولات ارگانیک',
    brand: {
      '@type': 'Brand',
      name: brandName,
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'IRR',
      price: String(finalPrice),
      availability: schemaAvailability,
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: siteContent?.brandName || 'اونیوال',
      },
    },
  };

  if (product.imageName && product.imageName.startsWith('http')) {
    schema.image = [product.imageName];
  }

  return schema;
}

export function buildArticleJsonLd(
  origin: string,
  post: Post,
  siteContent?: SiteContent | null
) {
  const brandName = siteContent?.brandName || 'اونیوال';
  const articleUrl = `${origin}/articles/${encodeURIComponent(post.slug)}`;
  const publishedIso =
    post.publishedAt && /^\d{4}-\d{2}-\d{2}/.test(post.publishedAt)
      ? post.publishedAt
      : '2025-09-01T10:00:00Z';
  const modifiedIso =
    post.updatedAt && /^\d{4}-\d{2}-\d{2}/.test(post.updatedAt)
      ? post.updatedAt
      : publishedIso;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription || post.description,
    url: articleUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    datePublished: publishedIso,
    dateModified: modifiedIso,
    author: {
      '@type': 'Person',
      name: post.authorName || `تحریریه ${brandName}`,
    },
    publisher: {
      '@type': 'Organization',
      name: brandName,
      url: `${origin}/`,
    },
    articleSection: post.categoryTitle || 'دانشنامه ارگانیک',
  };

  if (post.imageName && post.imageName.startsWith('http')) {
    schema.image = [post.imageName];
  }

  return schema;
}

/**
 * Resolves any incoming URL path against the current store state, returning HTTP status (200, 301, 404),
 * canonical URL, robots directives, OpenGraph tags, JSON-LD structured data, and crawlable semantic HTML.
 */
export function resolveSeoForPath(
  rawPathname: string,
  origin: string,
  data: {
    products: Product[];
    productCategories: ProductCategory[];
    posts: Post[];
    postCategories?: PostCategory[];
    siteContent?: SiteContent | null;
    slugRedirects?: SlugRedirect[];
  }
): ResolvedPageSeo {
  const pathname = (rawPathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const decodedPath = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch {
      return pathname;
    }
  })();

  const brandName = data.siteContent?.brandName || 'اونیوال';
  const brandEng = data.siteContent?.brandEnglishName || 'ONIVAL';
  const defaultImage =
    data.products.find((p) => !p.isDelete && p.status !== 'draft')?.imageName ||
    'https://images.unsplash.com/photo-1587049359535-b64d3dd0d716?w=800&auto=format&fit=crop&q=80';

  // 1. Check permanent 301 redirects first (when published slugs were changed in admin)
  const redirects = data.slugRedirects || [];
  const matchedRedirect = redirects.find(
    (r) => r.fromPath === decodedPath || r.fromPath === pathname
  );
  if (matchedRedirect && matchedRedirect.toPath !== decodedPath) {
    // Prevent redirect loops by resolving target maximum 1 hop
    const finalTarget =
      redirects.find((r) => r.fromPath === matchedRedirect.toPath)?.toPath ||
      matchedRedirect.toPath;
    if (finalTarget !== decodedPath) {
      return {
        status: 301,
        redirectTo: finalTarget,
        title: `انتقال آدرس | ${brandName}`,
        description: '',
        canonicalPath: finalTarget,
        canonicalUrl: `${origin}${finalTarget}`,
        robots: 'noindex, follow',
        ogType: 'website',
        ogTitle: brandName,
        ogDescription: '',
        ogImage: defaultImage,
        ogImageAlt: brandName,
        jsonLd: [],
        semanticHtml: '',
        routeType: 'home',
      };
    }
  }

  const publishedProducts = data.products.filter(
    (p) => !p.isDelete && (p.status || 'published') === 'published'
  );
  const publishedCategories = data.productCategories.filter(
    (c) => (c.status || 'published') === 'published'
  );
  const publishedPosts = data.posts.filter(
    (p) => (p.status || 'published') === 'published'
  );

  // 2. HOME PAGE: /
  if (decodedPath === '/') {
    const title =
      data.siteContent?.seoTitle ||
      `${brandName} | ${brandEng} - فروشگاه تخصصی عسل طبیعی و محصولات ارگانیک`;
    const description =
      data.siteContent?.seoDescription ||
      data.siteContent?.heroSubtitle ||
      `خرید مستقیم عسل طبیعی سبلان، ژل رویال شاهانه، گرده گل، دمنوش‌های گیاهی و خشکبار ارگانیک از فروشگاه ${brandName} (${brandEng}) با برگه آزمایشگاه و ضمانت اصالت.`;

    const productLinksHtml = publishedProducts
      .map(
        (p) =>
          `<li><article><a href="/products/${encodeURIComponent(p.slug)}"><h3>${escapeHtml(
            p.title
          )}</h3></a><p>${escapeHtml(p.description)}</p><span>قیمت: ${Number(
            p.price
          ).toLocaleString('fa-IR')} تومان</span></article></li>`
      )
      .join('');

    const categoryLinksHtml = publishedCategories
      .map(
        (c) =>
          `<li><a href="/categories/${encodeURIComponent(c.slug)}">${escapeHtml(c.title)}</a></li>`
      )
      .join('');

    const articleLinksHtml = publishedPosts
      .map(
        (post) =>
          `<li><article><a href="/articles/${encodeURIComponent(post.slug)}"><h3>${escapeHtml(
            post.title
          )}</h3></a><p>${escapeHtml(post.description)}</p></article></li>`
      )
      .join('');

    const semanticHtml = `
      <main id="seo-ssr-content" class="sr-only">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <nav aria-label="دسته‌بندی‌های فروشگاه">
          <h2>دسته‌بندی محصولات ${escapeHtml(brandName)}</h2>
          <ul>${categoryLinksHtml}</ul>
        </nav>
        <section>
          <h2>لیست محصولات ارگانیک ${escapeHtml(brandName)}</h2>
          <ul>${productLinksHtml}</ul>
        </section>
        <section>
          <h2>مقالات و دانشنامه تخصصی ${escapeHtml(brandName)}</h2>
          <ul>${articleLinksHtml}</ul>
        </section>
        <nav aria-label="صفحات اصلی">
          <a href="/">خانه</a> |
          <a href="/articles">مقالات</a> |
          <a href="/consultation">مشاوره تخصصی</a> |
          <a href="/about">درباره ما</a> |
          <a href="/contact">تماس با ما</a>
        </nav>
      </main>
    `;

    return {
      status: 200,
      title,
      description,
      canonicalPath: '/',
      canonicalUrl: `${origin}/`,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: `${brandName} - فروشگاه تخصصی محصولات ارگانیک`,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [{ name: `خانه ${brandName}`, path: '/' }]),
      ],
      semanticHtml,
      routeType: 'home',
    };
  }

  // 3. PRODUCT DETAIL PAGE: /products/:slug
  const productMatch = decodedPath.match(/^\/products\/([^/]+)$/);
  if (productMatch) {
    const slugParam = productMatch[1].trim().toLowerCase();
    const foundProduct = publishedProducts.find(
      (p) =>
        p.slug.toLowerCase() === slugParam ||
        sanitizeSlug(p.slug) === sanitizeSlug(slugParam) ||
        `id-${p.id}` === slugParam
    );

    if (!foundProduct) {
      return buildNotFoundSeo(decodedPath, origin, brandName);
    }

    const canonicalPath = `/products/${encodeURIComponent(foundProduct.slug)}`;
    const canonicalUrl =
      foundProduct.canonicalUrl && /^https?:\/\//i.test(foundProduct.canonicalUrl)
        ? foundProduct.canonicalUrl
        : `${origin}${canonicalPath}`;

    const title =
      foundProduct.seoTitle?.trim() ||
      `خرید ${foundProduct.title} | قیمت و مشخصات اصل در ${brandName}`;
    const description =
      foundProduct.seoDescription?.trim() ||
      foundProduct.description?.trim() ||
      `خرید اینترنتی ${foundProduct.title} از دسته ${
        foundProduct.categoryTitle || 'محصولات ارگانیک'
      } در فروشگاه تخصصی ${brandName} با تضمین کیفیت و ارسال سریع.`;

    const robots = foundProduct.robotsNoIndex
      ? `noindex, ${foundProduct.robotsNoFollow ? 'nofollow' : 'follow'}`
      : `index, ${foundProduct.robotsNoFollow ? 'nofollow' : 'follow'}, max-image-preview:large`;

    const categoryObj = publishedCategories.find((c) => c.id === foundProduct.categoryId);
    const breadcrumbItems = [{ name: 'خانه', path: '/' }];
    if (categoryObj) {
      breadcrumbItems.push({
        name: categoryObj.title,
        path: `/categories/${encodeURIComponent(categoryObj.slug)}`,
      });
    }
    breadcrumbItems.push({ name: foundProduct.title, path: canonicalPath });

    const featuresHtml = Array.isArray(foundProduct.features)
      ? `<ul>${foundProduct.features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
      : '';

    const sizesHtml = Array.isArray(foundProduct.sizes)
      ? `<ul>${foundProduct.sizes
          .map(
            (s) =>
              `<li>${escapeHtml(s.name)}: ${Number(s.price).toLocaleString('fa-IR')} تومان</li>`
          )
          .join('')}</ul>`
      : '';

    const semanticHtml = `
      <main id="seo-ssr-content" class="sr-only">
        <nav aria-label="Breadcrumb">
          <ol>
            ${breadcrumbItems
              .map((b) => `<li><a href="${escapeHtml(b.path)}">${escapeHtml(b.name)}</a></li>`)
              .join('')}
          </ol>
        </nav>
        <article>
          <h1>${escapeHtml(foundProduct.title)}</h1>
          <img src="${escapeHtml(foundProduct.imageName)}" alt="${escapeHtml(
            foundProduct.imageAlt || foundProduct.title
          )}" />
          <p>${escapeHtml(foundProduct.description)}</p>
          <div>${escapeHtml(foundProduct.content)}</div>
          <p>دسته‌بندی: ${escapeHtml(foundProduct.categoryTitle || 'محصولات ارگانیک')}</p>
          <p>قیمت پایه: ${Number(foundProduct.price).toLocaleString('fa-IR')} تومان</p>
          ${sizesHtml}
          ${featuresHtml}
        </article>
      </main>
    `;

    return {
      status: 200,
      title,
      description,
      canonicalPath,
      canonicalUrl,
      robots,
      ogType: 'product',
      ogTitle: foundProduct.ogTitle?.trim() || title,
      ogDescription: foundProduct.ogDescription?.trim() || description,
      ogImage: foundProduct.ogImage?.trim() || foundProduct.imageName || defaultImage,
      ogImageAlt: foundProduct.imageAlt?.trim() || foundProduct.title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, breadcrumbItems),
        buildProductJsonLd(origin, foundProduct, data.siteContent),
      ],
      semanticHtml,
      routeType: 'product',
      matchedProduct: foundProduct,
    };
  }

  // 4. CATEGORY PAGE: /categories/:slug
  const categoryMatch = decodedPath.match(/^\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const slugParam = categoryMatch[1].trim().toLowerCase();
    const foundCategory = publishedCategories.find(
      (c) =>
        c.slug.toLowerCase() === slugParam ||
        sanitizeSlug(c.slug) === sanitizeSlug(slugParam)
    );

    if (!foundCategory) {
      return buildNotFoundSeo(decodedPath, origin, brandName);
    }

    const canonicalPath = `/categories/${encodeURIComponent(foundCategory.slug)}`;
    const canonicalUrl = `${origin}${canonicalPath}`;
    const catProducts = publishedProducts.filter(
      (p) =>
        p.categoryId === foundCategory.id ||
        p.type === foundCategory.slug ||
        p.categoryTitle === foundCategory.title
    );

    const title =
      foundCategory.seoTitle?.trim() ||
      `خرید ${foundCategory.title} | لیست قیمت و محصولات اصل ${brandName}`;
    const description =
      foundCategory.seoDescription?.trim() ||
      foundCategory.description?.trim() ||
      `مشاهده و خرید آنلاین انواع ${foundCategory.title} با تضمین اصالت و آزمایشگاه در فروشگاه تخصصی ${brandName} (${brandEng}).`;

    const robots = foundCategory.robotsNoIndex
      ? 'noindex, follow'
      : 'index, follow, max-image-preview:large';

    const breadcrumbItems = [
      { name: 'خانه', path: '/' },
      { name: foundCategory.title, path: canonicalPath },
    ];

    const semanticHtml = `
      <main id="seo-ssr-content" class="sr-only">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="/">خانه</a></li>
            <li><a href="${escapeHtml(canonicalPath)}">${escapeHtml(foundCategory.title)}</a></li>
          </ol>
        </nav>
        <section>
          <h1>${escapeHtml(foundCategory.title)}</h1>
          <p>${escapeHtml(description)}</p>
          <ul>
            ${catProducts
              .map(
                (p) =>
                  `<li><article><a href="/products/${encodeURIComponent(p.slug)}"><h2>${escapeHtml(
                    p.title
                  )}</h2></a><p>${escapeHtml(p.description)}</p><span>${Number(
                    p.price
                  ).toLocaleString('fa-IR')} تومان</span></article></li>`
              )
              .join('')}
          </ul>
        </section>
      </main>
    `;

    return {
      status: 200,
      title,
      description,
      canonicalPath,
      canonicalUrl,
      robots,
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage:
        foundCategory.ogImage?.trim() ||
        foundCategory.imageName ||
        catProducts[0]?.imageName ||
        defaultImage,
      ogImageAlt: foundCategory.imageAlt || foundCategory.title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, breadcrumbItems),
      ],
      semanticHtml,
      routeType: 'category',
      matchedCategory: foundCategory,
    };
  }

  // 5. ARTICLES INDEX PAGE: /articles
  if (decodedPath === '/articles') {
    const title =
      data.siteContent?.articlesPageTitle ||
      `مجله و مقالات علمی ${brandName} | راهنمای عسل طبیعی و سلامت`;
    const description =
      data.siteContent?.articlesPageSubtitle ||
      `مقالات تخصصی ${brandName} درباره تشخیص عسل طبیعی از تقلبی، خواص درمانی ژل رویال و گرده گل، و دمنوش‌های گیاهی آرام‌بخش.`;

    const semanticHtml = `
      <main id="seo-ssr-content" class="sr-only">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="/">خانه</a></li>
            <li><a href="/articles">مقالات</a></li>
          </ol>
        </nav>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
        <ul>
          ${publishedPosts
            .map(
              (post) =>
                `<li><article><a href="/articles/${encodeURIComponent(
                  post.slug
                )}"><h2>${escapeHtml(post.title)}</h2></a><p>${escapeHtml(
                  post.description
                )}</p></article></li>`
            )
            .join('')}
        </ul>
      </main>
    `;

    return {
      status: 200,
      title,
      description,
      canonicalPath: '/articles',
      canonicalUrl: `${origin}/articles`,
      robots: 'index, follow, max-image-preview:large',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: publishedPosts[0]?.imageName || defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'مقالات علمی', path: '/articles' },
        ]),
      ],
      semanticHtml,
      routeType: 'articles',
    };
  }

  // 6. ARTICLE DETAIL PAGE: /articles/:slug
  const articleMatch = decodedPath.match(/^\/articles\/([^/]+)$/);
  if (articleMatch) {
    const slugParam = articleMatch[1].trim().toLowerCase();
    const foundPost = publishedPosts.find(
      (p) =>
        p.slug.toLowerCase() === slugParam ||
        sanitizeSlug(p.slug) === sanitizeSlug(slugParam) ||
        `id-${p.id}` === slugParam
    );

    if (!foundPost) {
      return buildNotFoundSeo(decodedPath, origin, brandName);
    }

    const canonicalPath = `/articles/${encodeURIComponent(foundPost.slug)}`;
    const canonicalUrl =
      foundPost.canonicalUrl && /^https?:\/\//i.test(foundPost.canonicalUrl)
        ? foundPost.canonicalUrl
        : `${origin}${canonicalPath}`;

    const title = foundPost.seoTitle?.trim() || `${foundPost.title} | مجله سلامت ${brandName}`;
    const description =
      foundPost.seoDescription?.trim() ||
      foundPost.description?.trim() ||
      foundPost.content.slice(0, 155);

    const robots = foundPost.robotsNoIndex
      ? `noindex, ${foundPost.robotsNoFollow ? 'nofollow' : 'follow'}`
      : `index, ${foundPost.robotsNoFollow ? 'nofollow' : 'follow'}, max-image-preview:large`;

    const breadcrumbItems = [
      { name: 'خانه', path: '/' },
      { name: 'مقالات علمی', path: '/articles' },
      { name: foundPost.title, path: canonicalPath },
    ];

    const semanticHtml = `
      <main id="seo-ssr-content" class="sr-only">
        <nav aria-label="Breadcrumb">
          <ol>
            ${breadcrumbItems
              .map((b) => `<li><a href="${escapeHtml(b.path)}">${escapeHtml(b.name)}</a></li>`)
              .join('')}
          </ol>
        </nav>
        <article>
          <h1>${escapeHtml(foundPost.title)}</h1>
          <p>نویسنده: ${escapeHtml(foundPost.authorName)} | دسته‌بندی: ${escapeHtml(
            foundPost.categoryTitle || 'عمومی'
          )}</p>
          <img src="${escapeHtml(foundPost.imageName)}" alt="${escapeHtml(
            foundPost.imageAlt || foundPost.title
          )}" />
          <p>${escapeHtml(foundPost.description)}</p>
          <div>${escapeHtml(foundPost.content)}</div>
        </article>
      </main>
    `;

    return {
      status: 200,
      title,
      description,
      canonicalPath,
      canonicalUrl,
      robots,
      ogType: 'article',
      ogTitle: foundPost.ogTitle?.trim() || title,
      ogDescription: foundPost.ogDescription?.trim() || description,
      ogImage: foundPost.ogImage?.trim() || foundPost.imageName || defaultImage,
      ogImageAlt: foundPost.imageAlt?.trim() || foundPost.title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, breadcrumbItems),
        buildArticleJsonLd(origin, foundPost, data.siteContent),
      ],
      semanticHtml,
      routeType: 'article',
      matchedPost: foundPost,
    };
  }

  // 7. PUBLIC INFORMATIONAL PAGES: /consultation, /about, /contact
  if (decodedPath === '/consultation') {
    const title = `رزرو مشاوره تخصصی سلامت و فرآورده‌های کندو | ${brandName}`;
    const description =
      data.siteContent?.consultationSubtitle ||
      `دریافت نوبت مشاوره تخصصی آنلاین با کارشناس طب سنتی و فرآورده‌های ارگانیک ${brandName} درباره خواص درمانی عسل، ژل رویال و دمنوش‌های گیاهی.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/consultation',
      canonicalUrl: `${origin}/consultation`,
      robots: 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'مشاوره تخصصی', path: '/consultation' },
        ]),
      ],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(
        title
      )}</h1><p>${escapeHtml(description)}</p></main>`,
      routeType: 'consultation',
    };
  }

  if (decodedPath === '/about') {
    const title = `${data.siteContent?.aboutTitle || `درباره فروشگاه ${brandName}`} | تضمین اصالت و آزمایشگاه`;
    const description =
      data.siteContent?.aboutParagraph1 ||
      `آشنایی با داستان و تعهد مجموعه تخصصی ${brandName} در عرضه مستقیم عسل خام سبلان و فرآورده‌های ارگانیک با برگه آزمایشگاهی.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/about',
      canonicalUrl: `${origin}/about`,
      robots: 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'درباره ما', path: '/about' },
        ]),
      ],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(
        title
      )}</h1><p>${escapeHtml(description)}</p></main>`,
      routeType: 'about',
    };
  }

  if (decodedPath === '/contact') {
    const title = `تماس با ما و پشتیبانی مشتریان | فروشگاه ${brandName}`;
    const description =
      data.siteContent?.contactSubtitle ||
      `اطلاعات تماس، نشانی، ساعات پاسخگویی و ارتباط مستقیم با پشتیبانی فروشگاه تخصصی ${brandName}.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/contact',
      canonicalUrl: `${origin}/contact`,
      robots: 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'تماس با ما', path: '/contact' },
        ]),
      ],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(
        title
      )}</h1><p>${escapeHtml(description)}</p></main>`,
      routeType: 'contact',
    };
  }

  // 7.1 TERMS & CONDITIONS: /terms, /rules
  if (decodedPath === '/terms' || decodedPath === '/rules') {
    const title = `${data.siteContent?.termsTitle || `قوانین و مقررات خرید`} | فروشگاه ${brandName}`;
    const description = `قوانین، مقررات، شرایط استفاده و نحوه ثبت و ارسال سفارشات در فروشگاه تخصصی ${brandName}.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/terms',
      canonicalUrl: `${origin}/terms`,
      robots: 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'قوانین و مقررات', path: '/terms' },
        ]),
      ],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></main>`,
      routeType: 'terms',
    };
  }

  // 7.2 REFUND & RETURN POLICY: /refund, /return-policy
  if (decodedPath === '/refund' || decodedPath === '/return-policy') {
    const title = `${data.siteContent?.refundTitle || `شرایط بازگشت کالا و رویه مرجوعی`} | فروشگاه ${brandName}`;
    const description = `رویه بازگشت کالا، شرایط مرجوعی ۷ روزه و ضمانت اصالت و سلامت فرآورده‌ها در فروشگاه ${brandName}.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/refund',
      canonicalUrl: `${origin}/refund`,
      robots: 'index, follow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [
        buildOrganizationJsonLd(origin, data.siteContent),
        buildBreadcrumbJsonLd(origin, [
          { name: 'خانه', path: '/' },
          { name: 'رویه مرجوعی و بازگشت کالا', path: '/refund' },
        ]),
      ],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></main>`,
      routeType: 'refund',
    };
  }

  // 8. UTILITY / PRIVATE / NOINDEX ROUTES: /tracking, /track-order, /checkout, /admin
  if (decodedPath === '/tracking' || decodedPath === '/track-order' || decodedPath === '/track') {
    const title = `پیگیری سفارش و استعلام وضعیت مرسوله | ${brandName}`;
    const description = `پیگیری لحظه‌ای وضعیت سفارش و نوبت مشاوره با کد رهگیری در فروشگاه ${brandName}.`;
    return {
      status: 200,
      title,
      description,
      canonicalPath: '/tracking',
      canonicalUrl: `${origin}/tracking`,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: description,
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [],
      semanticHtml: `<main id="seo-ssr-content" class="sr-only"><h1>${escapeHtml(
        title
      )}</h1></main>`,
      routeType: 'tracking',
    };
  }

  if (decodedPath === '/checkout') {
    const title = `تسویه حساب و صدور فاکتور رسمی | ${brandName}`;
    return {
      status: 200,
      title,
      description: 'صفحه پرداخت و صدور فاکتور سفارش',
      canonicalPath: '/checkout',
      canonicalUrl: `${origin}/checkout`,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogTitle: title,
      ogDescription: 'صفحه پرداخت و صدور فاکتور سفارش',
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [],
      semanticHtml: '',
      routeType: 'checkout',
    };
  }

  if (decodedPath === '/admin' || decodedPath.startsWith('/admin/')) {
    const title = `پنل مدیریت فروشگاه | ${brandName}`;
    return {
      status: 200,
      title,
      description: 'پنل مدیریت اختصاصی فروشگاه',
      canonicalPath: '/admin',
      canonicalUrl: `${origin}/admin`,
      robots: 'noindex, nofollow, noarchive',
      ogType: 'website',
      ogTitle: title,
      ogDescription: '',
      ogImage: defaultImage,
      ogImageAlt: title,
      jsonLd: [],
      semanticHtml: '',
      routeType: 'admin',
    };
  }

  // 9. GENUINE 404 FOR ANY OTHER NONEXISTENT ROUTE (prevents Soft 404s)
  return buildNotFoundSeo(decodedPath, origin, brandName);
}

function buildNotFoundSeo(
  decodedPath: string,
  origin: string,
  brandName: string
): ResolvedPageSeo {
  const title = `صفحه مورد نظر یافت نشد (۴۰۴) | ${brandName}`;
  const description = `صفحه درخواستی شما (${decodedPath}) در فروشگاه ${brandName} وجود ندارد یا حذف شده است.`;
  return {
    status: 404,
    title,
    description,
    canonicalPath: decodedPath,
    canonicalUrl: `${origin}${decodedPath}`,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogTitle: title,
    ogDescription: description,
    ogImage: '',
    ogImageAlt: title,
    jsonLd: [],
    semanticHtml: `
      <main id="seo-ssr-content" class="sr-only">
        <h1>۴۰۴ - صفحه مورد نظر یافت نشد</h1>
        <p>${escapeHtml(description)}</p>
        <a href="/">بازگشت به صفحه اصلی فروشگاه ${escapeHtml(brandName)}</a>
      </main>
    `,
    routeType: 'not_found',
  };
}

/**
 * Generates a valid, dynamic XML sitemap containing ONLY eligible 200-status,
 * published, indexable, canonical public URLs with accurate ISO lastmod timestamps.
 */
export function generateSitemapXml(
  origin: string,
  data: {
    products: Product[];
    productCategories: ProductCategory[];
    posts: Post[];
    siteContent?: SiteContent | null;
  }
): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const nowIso = new Date().toISOString().split('T')[0];

  const entries: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [];

  const toValidIsoDate = (raw?: string): string => {
    if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return raw.slice(0, 10);
    }
    return nowIso;
  };

  const publishedProducts = data.products.filter(
    (p) => !p.isDelete && (p.status || 'published') === 'published' && !p.robotsNoIndex
  );
  const publishedCategories = data.productCategories.filter(
    (c) => (c.status || 'published') === 'published' && !c.robotsNoIndex
  );
  const publishedPosts = data.posts.filter(
    (p) => (p.status || 'published') === 'published' && !p.robotsNoIndex
  );

  // Latest store content change for homepage lastmod
  const allDates = [
    ...publishedProducts.map((p) => toValidIsoDate(p.updatedAt || p.publishedAt)),
    ...publishedPosts.map((p) => toValidIsoDate(p.updatedAt || p.publishedAt)),
  ].sort();
  const latestMod = allDates[allDates.length - 1] || nowIso;

  // 1. Public core routes (excluding /admin, /checkout, /tracking)
  entries.push({
    loc: `${cleanOrigin}/`,
    lastmod: latestMod,
    changefreq: 'daily',
    priority: '1.0',
  });
  entries.push({
    loc: `${cleanOrigin}/articles`,
    lastmod: latestMod,
    changefreq: 'weekly',
    priority: '0.8',
  });
  entries.push({
    loc: `${cleanOrigin}/consultation`,
    lastmod: latestMod,
    changefreq: 'weekly',
    priority: '0.8',
  });
  entries.push({
    loc: `${cleanOrigin}/about`,
    lastmod: latestMod,
    changefreq: 'monthly',
    priority: '0.6',
  });
  entries.push({
    loc: `${cleanOrigin}/contact`,
    lastmod: latestMod,
    changefreq: 'monthly',
    priority: '0.6',
  });
  entries.push({
    loc: `${cleanOrigin}/terms`,
    lastmod: latestMod,
    changefreq: 'monthly',
    priority: '0.5',
  });
  entries.push({
    loc: `${cleanOrigin}/refund`,
    lastmod: latestMod,
    changefreq: 'monthly',
    priority: '0.5',
  });

  // 2. Eligible Product Categories
  for (const cat of publishedCategories) {
    entries.push({
      loc: `${cleanOrigin}/categories/${encodeURIComponent(cat.slug)}`,
      lastmod: toValidIsoDate(cat.updatedAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // 3. Eligible Products
  for (const prod of publishedProducts) {
    entries.push({
      loc: `${cleanOrigin}/products/${encodeURIComponent(prod.slug)}`,
      lastmod: toValidIsoDate(prod.updatedAt || prod.publishedAt),
      changefreq: 'weekly',
      priority: '0.9',
    });
  }

  // 4. Eligible Blog Articles
  for (const post of publishedPosts) {
    entries.push({
      loc: `${cleanOrigin}/articles/${encodeURIComponent(post.slug)}`,
      lastmod: toValidIsoDate(post.updatedAt || post.publishedAt),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  const urlNodes = entries
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>`;
}

/**
 * Generates a valid /robots.txt allowing Googlebot and other crawlers to read
 * page-level <meta name="robots" content="noindex, nofollow"> and X-Robots-Tag
 * headers on /admin, /checkout, and /tracking (per Google Search Central guidelines:
 * never disallow pages in robots.txt whose noindex directive must be read).
 * Only blocks non-HTML /api/ JSON endpoints.
 */
export function generateRobotsTxt(origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  return `User-agent: *
Allow: /
Allow: /products/
Allow: /categories/
Allow: /articles/
Disallow: /api/

Sitemap: ${cleanOrigin}/sitemap.xml
`;
}

/**
 * Synchronizes the browser's <head> tags (title, description, canonical, robots, OpenGraph, Twitter, JSON-LD)
 * on client-side route transitions.
 */
export function applyClientDocumentSeo(seo: ResolvedPageSeo) {
  if (typeof document === 'undefined') return;

  document.title = seo.title;

  const setMeta = (selector: string, attrName: 'name' | 'property', attrVal: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', seo.description);
  setMeta('meta[name="robots"]', 'name', 'robots', seo.robots);
  setMeta('meta[property="og:type"]', 'property', 'og:type', seo.ogType);
  setMeta('meta[property="og:title"]', 'property', 'og:title', seo.ogTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.ogDescription);
  setMeta('meta[property="og:url"]', 'property', 'og:url', seo.canonicalUrl);
  if (seo.ogImage) {
    setMeta('meta[property="og:image"]', 'property', 'og:image', seo.ogImage);
    setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', seo.ogImageAlt);
  }
  setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.ogTitle);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.ogDescription);
  if (seo.ogImage) {
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', seo.ogImage);
  }

  let canonicalEl = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', seo.canonicalUrl);

  let jsonLdScript = document.head.querySelector('script#onival-jsonld') as HTMLScriptElement | null;
  if (!jsonLdScript) {
    jsonLdScript = document.createElement('script');
    jsonLdScript.id = 'onival-jsonld';
    jsonLdScript.type = 'application/ld+json';
    document.head.appendChild(jsonLdScript);
  }
  jsonLdScript.textContent = JSON.stringify(seo.jsonLd);

  // 10. Torob & Emalls Standard Product Meta Tags
  if (seo.matchedProduct) {
    const prod = seo.matchedProduct;
    const isOutOfStock = prod.isOutOfStock || Number(prod.stock ?? 1) <= 0;
    const discount = Number(prod.discount ?? prod.discountPercent ?? 0) || 0;
    const basePrice = prod.sizes && prod.sizes.length > 0 ? prod.sizes[0].price : (Number(prod.price) || 0);
    const finalPrice = discount > 0 ? Math.round(basePrice * (100 - discount) / 100) : basePrice;
    const torobPrice = isOutOfStock ? 0 : finalPrice;
    const oldPrice = discount > 0 ? basePrice : finalPrice;
    const availability = isOutOfStock ? 'outofstock' : 'instock';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullImage = prod.imageName
      ? (prod.imageName.startsWith('http') ? prod.imageName : `${origin}${prod.imageName.startsWith('/') ? '' : '/'}${prod.imageName}`)
      : '';

    setMeta('meta[name="product_id"]', 'name', 'product_id', String(prod.id));
    setMeta('meta[name="product_name"]', 'name', 'product_name', prod.title);
    setMeta('meta[name="product_price"]', 'name', 'product_price', String(torobPrice));
    setMeta('meta[name="product_old_price"]', 'name', 'product_old_price', String(oldPrice));
    setMeta('meta[name="availability"]', 'name', 'availability', availability);
    if (fullImage) {
      setMeta('meta[property="og:image"]', 'property', 'og:image', fullImage);
    }
  } else {
    // Remove Torob product-specific tags when navigating to non-product pages
    ['product_id', 'product_name', 'product_price', 'product_old_price', 'availability'].forEach((name) => {
      const el = document.head.querySelector(`meta[name="${name}"]`);
      if (el) el.remove();
    });
  }
}

