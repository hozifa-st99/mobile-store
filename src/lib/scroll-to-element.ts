export function scrollElementToPageTop(
  element: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
) {
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top, behavior });
}

export function scrollElementToPageTopAfterPaint(
  element: HTMLElement | null,
  behavior: ScrollBehavior = "smooth"
) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollElementToPageTop(element, behavior);
    });
  });
}
