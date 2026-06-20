import { useEffect } from 'react';

type PageMetaOptions = {
  title: string;
  description?: string;
};

function setMetaTag(selector: string, attribute: string, value: string) {
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  }
}

export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    document.title = title;

    if (description) {
      setMetaTag('meta[name="description"]', 'content', description);
      setMetaTag('meta[property="og:title"]', 'content', title);
      setMetaTag('meta[property="og:description"]', 'content', description);
    }
  }, [title, description]);
}
