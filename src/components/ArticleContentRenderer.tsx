import React from 'react';
import { Image as ImageIcon, ZoomIn } from 'lucide-react';

interface ArticleContentRendererProps {
  content: string;
}

interface ContentBlock {
  type: 'paragraph' | 'image';
  text?: string;
  imageUrl?: string;
  caption?: string;
  align?: 'center' | 'right' | 'left' | 'full';
}

export const ArticleContentRenderer: React.FC<ArticleContentRendererProps> = ({ content }) => {
  if (!content) return null;

  // Parse custom image tags:
  // Format 1: [IMAGE: url | caption | align] or [عکس: url | caption | align]
  // Format 2: ![caption|align](url) or ![caption](url)
  const blocks: ContentBlock[] = [];
  const lines = content.split('\n');
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join('\n').trim();
      if (pText) {
        blocks.push({ type: 'paragraph', text: pText });
      }
      currentParagraphLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check for [IMAGE: ... ] or [عکس: ... ]
    const bracketMatch = trimmed.match(/^\[(?:IMAGE|عکس|تصویر)\s*:\s*([^|\]]+)(?:\|\s*([^|\]]+))?(?:\|\s*([^|\]]+))?\]$/i);
    if (bracketMatch) {
      flushParagraph();
      const imgUrl = bracketMatch[1].trim();
      const caption = bracketMatch[2]?.trim() || '';
      let alignRaw = bracketMatch[3]?.toLowerCase().trim() || 'center';
      let align: 'center' | 'right' | 'left' | 'full' = 'center';
      if (alignRaw.includes('right') || alignRaw.includes('راست')) align = 'right';
      else if (alignRaw.includes('left') || alignRaw.includes('چپ')) align = 'left';
      else if (alignRaw.includes('full') || alignRaw.includes('کامل') || alignRaw.includes('تمام')) align = 'full';

      blocks.push({
        type: 'image',
        imageUrl: imgUrl,
        caption,
        align
      });
      continue;
    }

    // Check for markdown image: ![caption|align](url) or ![caption](url)
    const mdMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (mdMatch) {
      flushParagraph();
      const rawCaption = mdMatch[1].trim();
      const imgUrl = mdMatch[2].trim();
      let caption = rawCaption;
      let align: 'center' | 'right' | 'left' | 'full' = 'center';

      if (rawCaption.includes('|')) {
        const parts = rawCaption.split('|');
        caption = parts[0].trim();
        const alignPart = parts[1].toLowerCase().trim();
        if (alignPart.includes('right') || alignPart.includes('راست')) align = 'right';
        else if (alignPart.includes('left') || alignPart.includes('چپ')) align = 'left';
        else if (alignPart.includes('full') || alignPart.includes('کامل')) align = 'full';
      }

      blocks.push({
        type: 'image',
        imageUrl: imgUrl,
        caption,
        align
      });
      continue;
    }

    // Regular line
    currentParagraphLines.push(rawLine);
  }

  flushParagraph();

  return (
    <div className="space-y-4 text-xs sm:text-sm text-stone-700 leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'image' && block.imageUrl) {
          const align = block.align || 'center';

          if (align === 'full') {
            return (
              <figure key={idx} className="my-6 w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs">
                <img
                  src={block.imageUrl}
                  alt={block.caption || 'تصویر داخل مقاله'}
                  className="w-full max-h-[460px] object-cover"
                  loading="lazy"
                />
                {block.caption && (
                  <figcaption className="p-3 bg-stone-50 border-t border-stone-100 text-center text-xs font-bold text-stone-500">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          if (align === 'right') {
            return (
              <figure key={idx} className="my-4 sm:float-right sm:ml-6 sm:mb-4 sm:w-1/2 w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs clear-right">
                <img
                  src={block.imageUrl}
                  alt={block.caption || 'تصویر داخل مقاله'}
                  className="w-full max-h-80 object-cover"
                  loading="lazy"
                />
                {block.caption && (
                  <figcaption className="p-2.5 bg-stone-50 border-t border-stone-100 text-center text-[11px] font-bold text-stone-500">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          if (align === 'left') {
            return (
              <figure key={idx} className="my-4 sm:float-left sm:mr-6 sm:mb-4 sm:w-1/2 w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs clear-left">
                <img
                  src={block.imageUrl}
                  alt={block.caption || 'تصویر داخل مقاله'}
                  className="w-full max-h-80 object-cover"
                  loading="lazy"
                />
                {block.caption && (
                  <figcaption className="p-2.5 bg-stone-50 border-t border-stone-100 text-center text-[11px] font-bold text-stone-500">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );
          }

          // Center alignment (default)
          return (
            <figure key={idx} className="my-6 max-w-2xl mx-auto rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs clear-both">
              <img
                src={block.imageUrl}
                alt={block.caption || 'تصویر داخل مقاله'}
                className="w-full max-h-[420px] object-cover"
                loading="lazy"
              />
              {block.caption && (
                <figcaption className="p-3 bg-stone-50 border-t border-stone-100 text-center text-xs font-bold text-stone-500 flex items-center justify-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>{block.caption}</span>
                </figcaption>
              )}
            </figure>
          );
        }

        // Paragraph text block
        return (
          <p key={idx} className="whitespace-pre-line leading-relaxed text-stone-700">
            {block.text}
          </p>
        );
      })}
    </div>
  );
};
