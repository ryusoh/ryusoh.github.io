git add sw.js .jules/architect.md .jules/sentinel.md
git commit -m "Refactor sw.js to reduce cyclomatic complexity and improve error handling

Extracted caching strategies and checks into independent helper functions \`isBasicResponse\`, \`isImageOrFontFile\`, \`handleFetchCacheFirst\` and \`handleFetchNetworkFirst\` to bring cyclomatic complexity of \`fetchLogic\` and \`isValidResponse\` to strictly below 5, maintaining structural health standards.
Enhanced generic catch block in \`handleFetchNetworkFirst\` to explicitly verify and log network failures for reliable debugging and graceful fallbacks, ensuring resilience and visibility.
Updated relevant journaling logs under \`.jules\` with architectural and operational security learnings."
