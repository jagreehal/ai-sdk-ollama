---
'ai-sdk-ollama': minor
---

Enhanced JSON repair for reliable object generation

- **New Feature**: Added `enhancedRepairText` function that automatically fixes 14+ types of common JSON issues from LLM outputs
- **Improved Reliability**: Enhanced `objectGenerationOptions` with comprehensive JSON repair capabilities including:
  - Markdown code block extraction
  - Comment removal
  - Smart quote fixing
  - Unquoted key handling
  - Trailing comma removal
  - Incomplete object/array completion
  - Python constant conversion (True/False/None)
  - JSONP wrapper removal
  - Single quote to double quote conversion
  - URL and escaped quote handling
  - Ellipsis pattern resolution
- **New Example**: Added `json-repair-example.ts` demonstrating enhanced repair capabilities
- **Enhanced Configuration**: `enableTextRepair` now defaults to `true` for better out-of-the-box reliability
- **Comprehensive Testing**: Added extensive test suite covering all repair scenarios
- **Backward Compatible**: All existing functionality remains unchanged
