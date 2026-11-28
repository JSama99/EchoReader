import type { ReadingDirection } from '../types';

/**
 * ComicInfo.xml (the ComicRack metadata convention used by most CBZ tools).
 * Only a handful of plain-text fields are read, with a size cap and no
 * entity expansion beyond the five XML basics, so no XML bomb can apply.
 */

export type ComicInfo = {
  title?: string;
  series?: string;
  number?: string;
  writer?: string;
  direction?: ReadingDirection;
};

const MAX = 64 * 1024;

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

function field(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([^<]{1,300})</${tag}>`));
  const v = m ? decode(m[1]) : '';
  return v ? v.slice(0, 200) : undefined;
}

export function parseComicInfo(xml: string): ComicInfo {
  if (xml.length > MAX || /<!ENTITY/i.test(xml)) return {};
  const manga = field(xml, 'Manga');
  return {
    title: field(xml, 'Title'),
    series: field(xml, 'Series'),
    number: field(xml, 'Number'),
    writer: field(xml, 'Writer'),
    direction: manga === 'YesAndRightToLeft' ? 'rtl' : undefined,
  };
}

/** Title for display: explicit title, else "Series #N", else the file name. */
export function displayTitle(info: ComicInfo, fileName: string): string {
  if (info.title) return info.series && info.number ? `${info.series} #${info.number}: ${info.title}` : info.title;
  if (info.series) return info.number ? `${info.series} #${info.number}` : info.series;
  return titleFromFileName(fileName);
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base.slice(0, 120) || 'Untitled';
}
