/* @flow */
import React, { Component } from 'react';
import { CompositeDecorator, Editor, EditorState, Modifier, RichUtils, Entity, ContentState } from 'draft-js';
import getDefaultKeyBinding from 'draft-js/lib/getDefaultKeyBinding';
import { getTextAlignBlockMetadata, getTextAlignClassName, getTextAlignStyles } from './lib/blockStyleFunctions';
import changeBlockDepth from './lib/changeBlockDepth';
import changeBlockType from './lib/changeBlockType';
import getBlocksInSelection from './lib/getBlocksInSelection';
import insertBlockAfter from './lib/insertBlockAfter';
import isListItem from './lib/isListItem';
import isSoftNewlineEvent from 'draft-js/lib/isSoftNewlineEvent';
import EditorToolbar, { getStateWithFullWordSelection } from './lib/EditorToolbar';
import EditorValue from './lib/EditorValue';
import LinkDecorator from './lib/LinkDecorator';
import ImageDecorator from './lib/ImageDecorator';
import composite from './lib/composite';
import cx from 'classnames';
import autobind from 'class-autobind';
import EventEmitter from 'events';
import { BLOCK_TYPE } from 'draft-js-utils';
import htmlToDraft from 'html-to-draftjs';

import { processStartBlockValue, processEndBlockValue, checkWhitespaceSelection } from './lib/EditorToolbar';

import { editOnPaste, EMPTY_PARAGRAPH_MARK, UNIQUE_PARAGRAPH } from './lib/onPasteEdit';

import './Draft.global.css';
import styles from './RichTextEditor.css';

import type { ContentBlock } from 'draft-js';
import type { ToolbarConfig, CustomControl } from './lib/EditorToolbarConfig';
import type { ImportOptions } from './lib/EditorValue';

import ButtonGroup from './ui/ButtonGroup';
import Button from './ui/Button';
import Dropdown from './ui/Dropdown';
import { hasCommandModifier } from 'draft-js/lib/KeyBindingUtil';
import { stateToHTML } from 'draft-js-export-html';

const MAX_LIST_DEPTH = 2;

// Custom overrides for "code" style.
const styleMap = {
  CODE: {
    backgroundColor: '#f3f3f3',
    fontFamily: '"Inconsolata", "Menlo", "Consolas", monospace',
    fontSize: 16,
    padding: 2,
  },
};

type ChangeHandler = (value: EditorValue) => any;

type Props = {
  className?: string;
  toolbarClassName?: string;
  editorClassName?: string;
  value: EditorValue;
  onChange?: ChangeHandler;
  placeholder?: string;
  customStyleMap?: { [style: string]: { [key: string]: any } };
  handleReturn?: (event: Object) => boolean;
  customControls?: Array<CustomControl>;
  readOnly?: boolean;
  toolbarHidden?: boolean;
  disabled?: boolean; // Alias of readOnly
  toolbarConfig?: ToolbarConfig;
  toolbarOnBottom?: boolean;
  blockStyleFn?: (block: ContentBlock) => ?string;
  autoFocus?: boolean;
  keyBindingFn?: (event: Object) => ?string;
  rootStyle?: Object;
  editorStyle?: Object;
  toolbarStyle?: Object;
  onBlur?: (event: Object) => void;
  onInsert: () => void;
};

export default class RichTextEditor extends Component {
  props: Props;
  _keyEmitter: EventEmitter;
  editor: HTMLDivElement;

  constructor() {
    super(...arguments);
    this._keyEmitter = new EventEmitter();
    autobind(this);
    this.state = {
      isOpen: false,
      lastFocusOffset: null,
      lastFocusKey: null,
    };
  }

  componentDidMount() {
    const { autoFocus } = this.props;

    if (!autoFocus) {
      return;
    }

    this._focus();
  }

  _onSymbolClick() {
    let editorState = this.props.value.getEditorState();
    const selectionState = editorState.getSelection();
    const lastFocusKey = selectionState.getFocusKey();
    const lastFocusOffset = selectionState.getStartOffset();
    this.setState({
      isOpen: true,
      lastFocusOffset,
      lastFocusKey,
    });
  }

  _onSymbolsPopoverClose(isManualClose) {
    let editorState = this.props.value.getEditorState();
    this.setState({
      isOpen: false
    });
    if (isManualClose) {
      return;
    }
    const selectionState = editorState.getSelection();
    const newSelectionState = selectionState.merge({
      focusOffset: this.state.lastFocusOffset + 1,
      focusKey: this.state.lastFocusKey,
    });
    this._onChange(EditorState.forceSelection(editorState, newSelectionState));
  }

  render() {
    let {
      value,
      className,
      toolbarClassName,
      editorClassName,
      placeholder,
      customStyleMap,
      readOnly,
      toolbarHidden,
      disabled,
      toolbarConfig,
      toolbarOnBottom,
      blockStyleFn,
      customControls,
      keyBindingFn,
      rootStyle,
      toolbarStyle,
      editorStyle,
      ...otherProps // eslint-disable-line comma-dangle
    } = this.props;
    let editorState = value.getEditorState();
    customStyleMap = customStyleMap ? { ...styleMap, ...customStyleMap } : styleMap;

    // If the user changes block type before entering any text, we can either
    // style the placeholder or hide it. Let's just hide it for now.
    let combinedEditorClassName = cx({
      [styles.editor]: true,
      [styles.hidePlaceholder]: this._shouldHidePlaceholder(),
    }, editorClassName);
    if (readOnly == null) {
      readOnly = disabled;
    }
    let editorToolbar;

    if (!readOnly && !toolbarHidden) {
      editorToolbar = (
        <EditorToolbar
          rootStyle={toolbarStyle}
          isOnBottom={toolbarOnBottom}
          className={toolbarClassName}
          keyEmitter={this._keyEmitter}
          editorState={editorState}
          onChange={this._onChange}
          onInsert={this._insertPoint}
          onToggleColor={this._toggleColor}
          insertSymbol={this._insertSymbol}
          focusEditor={this._focus}
          toolbarConfig={toolbarConfig}
          customControls={customControls}
          customStyleMap={customStyleMap}
          symbols={this.props.symbols}
          onSymbolClick={this._onSymbolClick}
          onSymbolsPopoverClose={this._onSymbolsPopoverClose}
          customRenderer={this.props.customRenderer}
          tooltipRenderer={this.props.tooltipRenderer}
          isOpen={this.state.isOpen}
        />
      );
    }
    return (
      <div className={cx(styles.root, className)} style={rootStyle}>
        {!toolbarOnBottom && editorToolbar}
        <div className={combinedEditorClassName} style={editorStyle}>
          <Editor
            {...otherProps}
            blockStyleFn={composite(defaultBlockStyleFn, blockStyleFn)}
            customStyleMap={customStyleMap}
            editorState={editorState}
            handleReturn={this._handleReturn}
            keyBindingFn={keyBindingFn || this._customKeyHandler}
            handleKeyCommand={this._handleKeyCommand}
            onTab={this._onTab}
            onChange={this._onChange}
            placeholder={placeholder}
            ariaLabel={placeholder || 'Edit text'}
            ref={(el) => {
              this.editor = el;
            }}
            spellCheck={true}
            readOnly={readOnly}
            onPaste={otherProps.onPaste ? otherProps.onPaste : (editor, e) => {
              editOnPaste(editor, e, this.props.onPasteValidation);
            }}
            onBlur={() => {
              if (!this.state.isOpen) {
                this.props.onBlur();
              }
            }}
          />
        </div>
        {toolbarOnBottom && editorToolbar}
      </div>
    );
  }

  _shouldHidePlaceholder(): boolean {
    let editorState = this.props.value.getEditorState();
    let contentState = editorState.getCurrentContent();
    if (!contentState.hasText()) {
      if (contentState.getBlockMap().first().getType() !== 'unstyled') {
        return true;
      }
    }
    return false;
  }

  _handleReturn(event: Object): boolean {
    let { handleReturn } = this.props;
    if (handleReturn != null && handleReturn(event)) {
      return true;
    }
    if (this._handleReturnSoftNewline(event)) {
      return true;
    }
    if (this._handleReturnEmptyListItem()) {
      return true;
    }
    if (this._handleReturnSpecialBlock()) {
      return true;
    }
    return false;
  }

  // `shift + return` should insert a soft newline.
  _handleReturnSoftNewline(event: Object): boolean {
    let editorState = this.props.value.getEditorState();
    if (isSoftNewlineEvent(event)) {
      let selection = editorState.getSelection();
      if (selection.isCollapsed()) {
        this._onChange(RichUtils.insertSoftNewline(editorState));
      } else {
        let content = editorState.getCurrentContent();
        let newContent = Modifier.removeRange(content, selection, 'forward');
        let newSelection = newContent.getSelectionAfter();
        let block = newContent.getBlockForKey(newSelection.getStartKey());
        newContent = Modifier.insertText(
          newContent,
          newSelection,
          '\n',
          block.getInlineStyleAt(newSelection.getStartOffset()),
          null,
        );
        this._onChange(
          EditorState.push(editorState, newContent, 'insert-fragment')
        );
      }
      return true;
    }
    return false;
  }

  // If the cursor is in an empty list item when return is pressed, then the
  // block type should change to normal (end the list).
  _handleReturnEmptyListItem(): boolean {
    let editorState = this.props.value.getEditorState();
    let selection = editorState.getSelection();
    if (selection.isCollapsed()) {
      let contentState = editorState.getCurrentContent();
      let blockKey = selection.getStartKey();
      let block = contentState.getBlockForKey(blockKey);
      if (isListItem(block) && block.getLength() === 0) {
        let depth = block.getDepth();
        let newState = (depth === 0) ?
          changeBlockType(editorState, blockKey, BLOCK_TYPE.UNSTYLED) :
          changeBlockDepth(editorState, blockKey, depth - 1);
        this._onChange(newState);
        return true;
      }
    }
    return false;
  }

  // If the cursor is at the end of a special block (any block type other than
  // normal or list item) when return is pressed, new block should be normal.
  _handleReturnSpecialBlock(): boolean {
    let editorState = this.props.value.getEditorState();
    let selection = editorState.getSelection();
    if (selection.isCollapsed()) {
      let contentState = editorState.getCurrentContent();
      let blockKey = selection.getStartKey();
      let block = contentState.getBlockForKey(blockKey);
      if (!isListItem(block) && block.getType() !== BLOCK_TYPE.UNSTYLED) {
        // If cursor is at end.
        if (block.getLength() === selection.getStartOffset()) {
          let newEditorState = insertBlockAfter(
            editorState,
            blockKey,
            BLOCK_TYPE.UNSTYLED
          );
          this._onChange(newEditorState);
          return true;
        }
      }
    }
    return false;
  }

  _onTab(event: Object): ?string {
    let editorState = this.props.value.getEditorState();
    let newEditorState = RichUtils.onTab(event, editorState, MAX_LIST_DEPTH);
    if (newEditorState !== editorState) {
      this._onChange(newEditorState);
    }
  }

  _customKeyHandler(event: Object): ?string {
    // Allow toolbar to catch key combinations.
    let eventFlags = {};
    this._keyEmitter.emit('keypress', event, eventFlags);

    let keyCommand = getDefaultKeyBinding(event);

    // F4+Shift - insert point for replace
    if (!keyCommand && event.keyCode === 115 && event.shiftKey && !event.ctrlKey) {
      event.preventDefault();
      this._insertPoint();
      return;
    }
    // F4+Ctrl - call async insert
    if (!keyCommand && event.keyCode === 115 && !event.shiftKey && event.ctrlKey) {
      event.preventDefault();
      this.props.onInsert && this.props.onInsert();
      return;
    }
    // F4 - call sync insert
    if (!keyCommand && event.keyCode === 115) {
      event.preventDefault();
      this._syncInsert();
      return;
    }
    // F8 - highlight selected text
    if (!keyCommand && event.keyCode === 119) {
      event.preventDefault();
      this._toggleColor(true)();
      return;
    }
    // F9 - remove highlight from selected text
    if (!keyCommand && event.keyCode === 120) {
      event.preventDefault();
      this._toggleColor()();
      return;
    }
    // Ctrl + K - additional hotkey for italic format
    if (hasCommandModifier(event) && event.keyCode === 75) {
      keyCommand = 'italic';
    }

    if (['bold', 'italic', 'underline'].includes(keyCommand)) {
      const editorState = this.props.value.getEditorState();
      const updatedState = getStateWithFullWordSelection(editorState);
      this._onChange(RichUtils.toggleInlineStyle(updatedState, keyCommand.toUpperCase()));
      event.preventDefault();
      return null;
    }

    if (eventFlags.wasHandled) {
      return null;
    } else {
      return keyCommand;
    }
  }

  _toggleColor = (isSelection) => () => {
    const toggledColor = isSelection ? 'yellow-dropdown_option' : '';
    const editorState = this.props.value.getEditorState();
    let selection = editorState.getSelection();
    let contentState = editorState.getCurrentContent();
    let origSelection = selection;
    let nextContentState = editorState.getCurrentContent().createEntity(isSelection ? 'LINK' : 'SPAN', 'MUTABLE', { className: toggledColor });
    let nextEditorState = EditorState.push(
      editorState,
      nextContentState,
      'change-inline-style'
    );

    let entityKey = nextContentState.getLastCreatedEntityKey();
    nextEditorState = EditorState.push(nextEditorState, contentState);
    nextEditorState = RichUtils.toggleLink(nextEditorState, selection, entityKey);
    nextEditorState = EditorState.acceptSelection(nextEditorState, origSelection);

    this._onChange(nextEditorState);
  }

  _insertSymbol(symbol) {
    const editorState = this.props.value.getEditorState();
    let currentContent = editorState.getCurrentContent();
    let selection = editorState.getSelection();

    if (!selection.isCollapsed()) {
      currentContent = Modifier.removeRange(currentContent, selection, 'forward');
      selection = currentContent.getSelectionAfter();
    }

    const entityKey = Entity.create('SPAN', 'MUTABLE');
    const textWithEntity = Modifier.insertText(
      currentContent,
      selection,
      symbol,
      null,
      entityKey
    );

    const newEditorState = EditorState.push(editorState, textWithEntity, 'insert-characters');
    this._onChange(newEditorState);

    setTimeout(() => {
      this._onSymbolsPopoverClose();
    });
  };

  _insertHTMLByProps({
    value,
    anchorOffset,
    focusOffset,
    anchorKey,
    focusKey,
  }) {
    let valueToInsert = value;
    if (
      valueToInsert.includes('<|') && valueToInsert.includes('|>') ||
      valueToInsert.includes('&lt;|') && valueToInsert.includes('|&gt;')
    ) {
      valueToInsert = valueToInsert
        .replaceAll('<|', '<a><|')
        .replaceAll('|>', '|></a>')
        .replaceAll('&lt;|', '<a><|')
        .replaceAll('|&gt;', '|></a>')
    }

    const editorState = this.props.value.getEditorState();
    const selection = editorState.getSelection();
    let currentContent = editorState.getCurrentContent();

    const endBlockValue = currentContent.getBlockForKey(anchorKey).getText();
    const startBlockValue = currentContent.getBlockForKey(focusKey).getText();

    const anchor = processEndBlockValue(anchorOffset, endBlockValue);
    const focus = processStartBlockValue(focusOffset, startBlockValue);

    let newSelectionState = selection.merge({
      anchorOffset: anchor,
      focusOffset: focus,
      anchorKey: anchorKey,
      focusKey: focusKey,
      isBackward: true,
    });

    if (!newSelectionState.isCollapsed()) {
      currentContent = Modifier.removeRange(currentContent, newSelectionState, 'forward');
      newSelectionState = currentContent.getSelectionAfter();
    }

    const { contentBlocks, entityMap } = htmlToDraft(valueToInsert);
    currentContent = Modifier.replaceWithFragment(
      currentContent,
      newSelectionState,
      ContentState.createFromBlockArray(contentBlocks, entityMap).getBlockMap()
    );

    let htmlValue = stateToHTML(currentContent);

    this.props.onChange(createValueFromString(htmlValue, 'html', {
      customInlineFn(elem, { Entity }) {
        const { tagName, className } = elem;
        if (tagName === 'A' && className === 'orange_insert-point') {
          return Entity('LINK', { className: 'orange_insert-point' });
        }
        if (tagName === 'A' && className === '') {
          return Entity('LINK', { className: 'yellow-dropdown_option' });
        }
        if (className === 'text-outdent') {
          return Entity('SPAN');
        }
      }
    }));
  }

  async _syncInsert() {
    if (!this.props.syncInsertRequest) {
      return;
    }

    const editorState = this.props.value.getEditorState();
    const selectionState = editorState.getSelection();
    let anchorKey = selectionState.getAnchorKey();
    let focusKey = selectionState.getFocusKey();
    let anchorOffset = selectionState.getEndOffset();
    let focusOffset = selectionState.getStartOffset();

    let currentContent = editorState.getCurrentContent();
    const endBlockValue = currentContent.getBlockForKey(anchorKey).getText();
    const startBlockValue = currentContent.getBlockForKey(focusKey).getText();

    focusOffset = processStartBlockValue(focusOffset, startBlockValue);
    anchorOffset = processEndBlockValue(anchorOffset, endBlockValue);

    const isWhiteSpaceSelected = checkWhitespaceSelection(
      focusOffset,
      anchorOffset,
      startBlockValue,
      endBlockValue
    );

    if (focusOffset === anchorOffset && !isWhiteSpaceSelected) {
      console.log('wrong position of cursor');
      return null;
    }
    const word = startBlockValue.substring(focusOffset, anchorOffset);
    if (word.trim().includes(' ')) {
      console.log('wrong ID to send');
      return;
    }

    const value = await this.props.syncInsertRequest(word, focusOffset, anchorOffset, anchorKey, focusKey);

    if (typeof value !== 'string') {
      return;
    }

    this._insertHTMLByProps({
      value,
      anchorOffset,
      focusOffset,
      anchorKey,
      focusKey,
    });
  }

  _insertPoint() {
    const editorState = this.props.value.getEditorState();
    let currentContent = editorState.getCurrentContent();
    let selection = editorState.getSelection();

    if (!selection.isCollapsed()) {
      currentContent = Modifier.removeRange(currentContent, selection, 'forward');
      selection = currentContent.getSelectionAfter();
    }

    const entityKey = Entity.create(
      'LINK', 'MUTABLE', { className: 'orange_insert-point' }
    );
    const textWithEntity = Modifier.insertText(
      currentContent,
      selection,
      '<||>',
      null,
      entityKey
    );

    const newEditorState = EditorState.push(editorState, textWithEntity, 'insert-characters');
    this._onChange(newEditorState);
  }

  _handleKeyCommand(command: string): boolean {
    let editorState = this.props.value.getEditorState();
    let newEditorState = RichUtils.handleKeyCommand(editorState, command);
    if (newEditorState) {
      this._onChange(newEditorState);
      return true;
    } else {
      return false;
    }
  }

  _onChange(editorState: EditorState, isIndent?: boolean) {
    let { onChange, value } = this.props;
    if (onChange == null) {
      return;
    }
    let newValue = value.setEditorState(editorState);
    let valueString = newValue.toString('html');
    if (valueString.includes(UNIQUE_PARAGRAPH)) {
      valueString = valueString.replaceAll(UNIQUE_PARAGRAPH, '<p><br></p>');
      onChange(createValueFromString(valueString, 'html'));
      return;
    }

    if (isIndent) {
      return this._wrappIndents(editorState);
    }

    let newEditorState = newValue.getEditorState();
    this._handleInlineImageSelection(newEditorState);
    onChange(newValue);
  }

  _wrappIndents(editorState) {
    let { onChange, value } = this.props;
    let newValue = value.setEditorState(editorState);
    let valueString = newValue.toString('html');

    const commonMatch = valueString.match(window.commonRegex);
    const endMatch = valueString.match(window.commonRegexEnd);
    const startMatch = valueString.match(window.commonRegexStart);

    const isMatched = commonMatch || endMatch || startMatch;

    if (!isMatched) {
      return onChange(newValue);
    }
    commonMatch && commonMatch.forEach((value) => {
      valueString = valueString.replace(value, `</p>\n<p>${value.trim()}</p>\n<p>`)
    });
    endMatch && endMatch.forEach((value) => {
      valueString = valueString.replace(value, `</p>\n<p>${value.trim()}`)
    });
    startMatch && startMatch.forEach((value) => {
      valueString = valueString.replace(value, `${value.trim()}</p>\n<p>`)
    });
    onChange(createValueFromString(valueString, 'html', {
      customInlineFn(elem, { Entity }) {
        const { className } = elem;
        if (className === 'text-indent') {
          return Entity('LINK', { className });
        }
        if (className === 'text-outdent') {
          return Entity('SPAN');
        }
      }
    }));
    setTimeout(() => {
      this.editor.focus();
    });
  }

  _handleInlineImageSelection(editorState: EditorState) {
    let selection = editorState.getSelection();
    let blocks = getBlocksInSelection(editorState);

    const selectImage = (block, offset) => {
      const imageKey = block.getEntityAt(offset);
      Entity.mergeData(imageKey, { selected: true });
    };

    let isInMiddleBlock = (index) => index > 0 && index < blocks.size - 1;
    let isWithinStartBlockSelection = (offset, index) => (
      index === 0 && offset > selection.getStartOffset()
    );
    let isWithinEndBlockSelection = (offset, index) => (
      index === blocks.size - 1 && offset < selection.getEndOffset()
    );

    blocks.toIndexedSeq().forEach((block, index) => {
      ImageDecorator.strategy(
        block,
        (offset) => {
          if (isWithinStartBlockSelection(offset, index) ||
            isInMiddleBlock(index) ||
            isWithinEndBlockSelection(offset, index)) {
            selectImage(block, offset);
          }
        });
    });
  }

  _focus() {
    this.editor.focus();
  }
}

function defaultBlockStyleFn(block: ContentBlock): string {
  let result = styles.block;
  switch (block.getType()) {
    case 'unstyled':
      return cx(result, styles.paragraph);
    case 'blockquote':
      return cx(result, styles.blockquote);
    case 'code-block':
      return cx(result, styles.codeBlock);
    default:
      return result;
  }
}

const decorator = new CompositeDecorator([LinkDecorator, ImageDecorator]);

function createEmptyValue(): EditorValue {
  return EditorValue.createEmpty(decorator);
}

function createValueFromString(markup: string, format: string, options?: ImportOptions): EditorValue {
  return EditorValue.createFromString(markup, format, decorator, options);
}

// $FlowIssue - This should probably not be done this way.
Object.assign(RichTextEditor, {
  EditorValue,
  decorator,
  createEmptyValue,
  createValueFromString,
  ButtonGroup,
  Button,
  Dropdown,
  Entity,
});

export {
  EditorValue,
  decorator,
  createEmptyValue,
  createValueFromString,
  getTextAlignBlockMetadata,
  getTextAlignClassName,
  getTextAlignStyles,
  ButtonGroup,
  Button,
  Dropdown,
  EMPTY_PARAGRAPH_MARK,
  UNIQUE_PARAGRAPH,
  editOnPaste,
  Entity,
};
