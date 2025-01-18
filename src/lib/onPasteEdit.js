
import DraftModifier from 'draft-js/lib/DraftModifier';
import DraftPasteProcessor from 'draft-js/lib/DraftPasteProcessor';
import EditorState from 'draft-js/lib/EditorState';
import BlockMapBuilder from 'draft-js/lib/BlockMapBuilder';
import CharacterMetadata from 'draft-js/lib/CharacterMetadata';
import getEntityKeyForSelection from 'draft-js/lib/getEntityKeyForSelection';
import DataTransfer from 'fbjs/lib/DataTransfer';
import { stateToHTML } from 'draft-js-export-html';
import { ContentState, convertFromHTML } from 'draft-js';

export const UNIQUE_PARAGRAPH = '<p>__unique_draftjs_empty_paragraph</p>';
export const EMPTY_PARAGRAPH_MARK = '<span>__unique_draftjs_empty_paragraph</span>';
export const emptyLineRegex = /<br data-text="true">/g;

const NEWLINE_REGEX = /\r\n?|\n/g;

function splitTextIntoTextBlocks(text) {
  return text.split(NEWLINE_REGEX);
};

function insertFragment(editorState, fragment, entityMap) {
  var newContent = DraftModifier.replaceWithFragment(editorState.getCurrentContent(), editorState.getSelection(), fragment);
  return EditorState.push(editorState, newContent.set('entityMap', entityMap), 'insert-fragment');
}

function isEventHandled(value) {
  return value === 'handled' || value === true;
};

function areTextBlocksAndClipboardEqual(textBlocks, blockMap) {
  return textBlocks.length === blockMap.size && blockMap.valueSeq().every(function (block, ii) {
    return block.getText() === textBlocks[ii];
  });
};

export const editOnPaste = async (editor, e, onPasteValidation) => {
  e.preventDefault();
  const data = new DataTransfer(e.clipboardData);
  const RTFValue = e.clipboardData.getData('text/rtf');

  var textBlocks = [];
  var text = data.getText();
  var html = data.getHTML();
  var editorState = editor._latestEditorState;

  html = html && html.replaceAll(emptyLineRegex, EMPTY_PARAGRAPH_MARK);

  if (editor.props.handlePastedText && isEventHandled(editor.props.handlePastedText(text, html, editorState))) {
    return;
  }

  if (text) {
    textBlocks = splitTextIntoTextBlocks(text);
  }

  if (!editor.props.stripPastedStyles) {
    var internalClipboard = editor.getClipboard();
    if (data.isRichText() && internalClipboard) {
      if (
        html.indexOf(editor.getEditorKey()) !== -1 ||
        textBlocks.length === 1 && internalClipboard.size === 1 && internalClipboard.first().getText() === text) {
        const newState = insertFragment(editor._latestEditorState, internalClipboard);
        // const pastedHTML = stateToHTML(newState.getCurrentContent());
        // copy/paste from rte to rte
        editor.update(newState);
        return;
      }
    } else if (internalClipboard && data.types.includes('com.apple.webarchive') && !data.types.includes('text/html') && areTextBlocksAndClipboardEqual(textBlocks, internalClipboard)) {
      editor.update(insertFragment(editor._latestEditorState, internalClipboard));
      return;
    }

    if (html) {
      // var htmlFragment = DraftPasteProcessor.processHTML(html, editor.props.blockRenderMap);
      let htmlFragment = convertFromHTML(html);

      if (htmlFragment) {
        var contentBlocks = htmlFragment.contentBlocks;
        var entityMap = htmlFragment.entityMap;

        if (contentBlocks) {
          const pastedContentState = ContentState.createFromBlockArray(htmlFragment.contentBlocks, htmlFragment.entityMap);
          const pastedHTML = stateToHTML(pastedContentState);

          var htmlMap = BlockMapBuilder.createFromArray(contentBlocks);
          const newState = insertFragment(editor._latestEditorState, htmlMap, entityMap);

          if (!onPasteValidation) {
            editor.update(newState);
            return;
          }

          try {
            const correctedHTML = await onPasteValidation(pastedHTML);
            if (!correctedHTML) {
              return;
            }

            if (pastedHTML === correctedHTML) {
              editor.update(newState);
              return;
            }

            // const processor = DraftPasteProcessor.processHTML(correctedHTML, editor.props.blockRenderMap);
            const processor = convertFromHTML(correctedHTML);
            if (processor.contentBlocks) {
              const map = BlockMapBuilder.createFromArray(processor.contentBlocks);
              const state = insertFragment(editor._latestEditorState, map, processor.entityMap);
              editor.update(state);
              return;
            }

          } catch (e) {
            console.log(e)
          }
          return;
        }
      }
    }

    editor.setClipboard(null);
  }

  if (RTFValue && onPasteValidation) {
    try {
      const HTMLFromRTF = await onPasteValidation(RTFValue);

      if (!HTMLFromRTF) {
        return;
      }

      // const processor = DraftPasteProcessor.processHTML(HTMLFromRTF, editor.props.blockRenderMap);
      const processor = convertFromHTML(HTMLFromRTF);
      if (processor.contentBlocks) {
        const map = BlockMapBuilder.createFromArray(processor.contentBlocks);
        const state = insertFragment(editor._latestEditorState, map, processor.entityMap);
        editor.update(state);
        return;
      }
    } catch (e) {
      console.log(e);
    }
  }

  if (textBlocks.length) {
    var character = CharacterMetadata.create({
      style: editorState.getCurrentInlineStyle(),
      entity: getEntityKeyForSelection(editorState.getCurrentContent(), editorState.getSelection())
    });

    var textFragment = DraftPasteProcessor.processText(textBlocks, character);

    var textMap = BlockMapBuilder.createFromArray(textFragment);
    editor.update(insertFragment(editor._latestEditorState, textMap));
  }
}