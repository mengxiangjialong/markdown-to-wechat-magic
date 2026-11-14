<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Copy article content as both `text/html` with inline styles and `text/plain` with readable article text; use a copy-event fallback so rich-text editors never receive HTML source as plain text.
- Restore unmarked parallel list items before punctuation-line merging in the paste normalizer, with narrow recognition and fence awareness to avoid changing ordinary prose or code.
- Convert clipboard HTML headings and bold formatting to Markdown before text normalization; isolate preformatted code first so article formatting never changes code.
- Punctuation-line merging must preserve standalone container delimiters and fenced code lines, so article extensions and code syntax remain intact.
