/* @flow */
import { hasCommandModifier } from 'draft-js/lib/KeyBindingUtil';

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { EditorState, Entity, EntityDescription, RichUtils, Modifier } from 'draft-js';
import { ENTITY_TYPE } from 'draft-js-utils';
import DefaultToolbarConfig from './EditorToolbarConfig';
import StyleButton from './StyleButton';
import PopoverIconButton from '../ui/PopoverIconButton';
import ButtonGroup from '../ui/ButtonGroup';
import Dropdown from '../ui/Dropdown';
import IconButton from '../ui/IconButton';
import getEntityAtCursor from './getEntityAtCursor';
import clearEntityForRange from './clearEntityForRange';
import autobind from 'class-autobind';
import cx from 'classnames';

import styles from './EditorToolbar.css';

import type EventEmitter from 'events';
import type { ToolbarConfig, CustomControl } from './EditorToolbarConfig';

type ChangeHandler = (state: EditorState) => any;

type Props = {
  className?: string;
  editorState: EditorState;
  keyEmitter: EventEmitter;
  onChange: ChangeHandler;
  focusEditor: Function;
  toolbarConfig: ToolbarConfig;
  customControls: Array<CustomControl>;
  rootStyle?: Object;
  isOnBottom?: boolean;
  customStyleMap: Object;
};

type State = {
  showLinkInput: boolean;
  showImageInput: boolean;
  customControlState: { [key: string]: string };
};


export default class EditorToolbar extends Component {
  props: Props;
  state: State;

  constructor() {
    super(...arguments);
    autobind(this);
    this.state = {
      showLinkInput: false,
      showImageInput: false,
      customControlState: {},
    };
    this.buttonRef = React.createRef();
    this.blockTypeRef = React.createRef();
    this.inlineTypeRef = React.createRef();
  }

  // eslint-disable-next-line
  UNSAFE_componentWillMount() {
    // Technically, we should also attach/detach event listeners when the
    // `keyEmitter` prop changes.
    this.props.keyEmitter.on('keypress', this._onKeypress);
  }

  componentWillUnmount() {
    this.props.keyEmitter.removeListener('keypress', this._onKeypress);
  }

  render() {
    let { className, toolbarConfig, rootStyle, isOnBottom } = this.props;
    if (toolbarConfig == null) {
      toolbarConfig = DefaultToolbarConfig;
    }
    let display = toolbarConfig.display || DefaultToolbarConfig.display;
    let buttonGroups = display.map((groupName) => {
      switch (groupName) {
        case 'INLINE_STYLE_BUTTONS': {
          return this._renderInlineStyleButtons(groupName, toolbarConfig);
        }
        case 'BLOCK_ALIGNMENT_BUTTONS': {
          return this._renderBlockAlignmentButtons(groupName, toolbarConfig);
        }
        case 'BLOCK_TYPE_DROPDOWN': {
          return this._renderBlockTypeDropdown(groupName, toolbarConfig);
        }
        case 'LINK_BUTTONS': {
          return this._renderLinkButtons(groupName, toolbarConfig);
        }
        case 'IMAGE_BUTTON': {
          return this._renderImageButton(groupName, toolbarConfig);
        }
        case 'BLOCK_TYPE_BUTTONS': {
          return this._renderBlockTypeButtons(groupName, toolbarConfig);
        }
        case 'HISTORY_BUTTONS': {
          return this._renderUndoRedo(groupName, toolbarConfig);
        }
        case 'EXTRA_OPTIONS': {
          return this._extraOptions(groupName, toolbarConfig);
        }
      }
    });
    return (
      <div className={cx(styles.root, (isOnBottom && styles.onBottom), className)} style={rootStyle}>
        {buttonGroups}
        {this._renderCustomControls()}
      </div>
    );
  }

  _renderCustomControls() {
    let { customControls, editorState } = this.props;
    if (customControls == null) {
      return;
    }
    return customControls.map((f) => {
      switch (typeof f) {
        case 'function': {
          return f(
            this._setCustomControlState,
            this._getCustomControlState,
            editorState
          );
        }
        default: {
          return f;
        }
      }
    });
  }

  _setCustomControlState(key: string, value: string) {
    this.setState(({ customControlState }) => ({
      customControlState: { ...customControlState, [key]: value },
    }));
  }

  _getCustomControlState(key: string) {
    return this.state.customControlState[key];
  }

  _renderBlockTypeDropdown(name: string, toolbarConfig: ToolbarConfig) {
    let blockType = this._getCurrentBlockType();
    let choices = new Map(
      (toolbarConfig.BLOCK_TYPE_DROPDOWN || []).map((type) => [type.style, { label: type.label, className: type.className }])
    );
    if (!choices.has(blockType)) {
      blockType = Array.from(choices.keys())[0];
    }
    return (
      <ButtonGroup key={name}>
        <Dropdown
          {...toolbarConfig.extraProps}
          choices={choices}
          selectedKey={blockType}
          onChange={this._selectBlockType}
          aria-label={'Block type'}
        />
      </ButtonGroup>
    );
  }

  _renderBlockTypeButtons(name: string, toolbarConfig: ToolbarConfig) {
    let blockType = this._getCurrentBlockType();
    let buttons = (toolbarConfig.BLOCK_TYPE_BUTTONS || []).map((type, index) => (
      this.props.tooltipRenderer ? this.props.tooltipRenderer(<StyleButton
        {...toolbarConfig.extraProps}
        key={String(index)}
        isActive={type.style === blockType}
        label={type.label}
        onToggle={this._toggleBlockType}
        style={type.style}
        className={type.className}
      />, this.blockTypeRef, type) :
        <StyleButton
          {...toolbarConfig.extraProps}
          key={String(index)}
          isActive={type.style === blockType}
          label={type.label}
          onToggle={this._toggleBlockType}
          style={type.style}
          className={type.className}
        />
    ));
    return (
      <ButtonGroup key={name} innerRef={this.blockTypeRef}>{buttons}</ButtonGroup>
    );
  }

  _renderInlineStyleButtons(name: string, toolbarConfig: ToolbarConfig) {
    let { editorState } = this.props;
    let currentStyle = editorState.getCurrentInlineStyle();
    let buttons = (toolbarConfig.INLINE_STYLE_BUTTONS || []).map((type, index) => (
      this.props.tooltipRenderer ? this.props.tooltipRenderer(<StyleButton
        {...toolbarConfig.extraProps}
        key={String(index)}
        isActive={currentStyle.has(type.style)}
        label={type.label}
        onToggle={this._toggleInlineStyle}
        style={type.style}
        className={type.className}
      />, this.inlineTypeRef, type) :
        <StyleButton
          {...toolbarConfig.extraProps}
          key={String(index)}
          isActive={currentStyle.has(type.style)}
          label={type.label}
          onToggle={this._toggleInlineStyle}
          style={type.style}
          className={type.className}
        />
    ));
    return (
      <ButtonGroup key={name} innerRef={this.inlineTypeRef}>{buttons}</ButtonGroup>
    );
  }

  _extraOptions(name: String, toolbarConfig: ToolbarConfig) {
    return (
      <ButtonGroup key={name} innerRef={this.buttonRef}>
        {toolbarConfig.EXTRA_OPTIONS.add && (
          <button onClick={this.props.onToggleColor(true)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.add(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.remove && (
          <button onClick={this.props.onToggleColor(false)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.remove(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.indent && (
          <button onClick={this.indent(true)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.indent(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.outdent && (
          <button onClick={this.indent(false)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.outdent(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.insert && (
          <button onClick={this.props.onInsert} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.insert(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.undo && (
          <button onClick={this._undo} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.undo(this.buttonRef)}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.redo && (
          <button onClick={this._redo} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.redo(this.buttonRef)}
          </button>
        )}
        {this.props.symbols && this.props.symbols.length && this.props.customRenderer({
          open: this.props.isOpen,
          onClick: this.props.insertSymbol,
          onOpenChange: this.props.onSymbolClick,
          innerRef: this.buttonRef,
          onButtonClick: () => {
            if (this.props.isOpen) {
              this.props.onSymbolsPopoverClose(true);
            }
          }
        })}
      </ButtonGroup>
    );
  }

  _renderBlockAlignmentButtons(name: string, toolbarConfig: ToolbarConfig) {
    let { editorState } = this.props;
    let content = editorState.getCurrentContent();
    let selection = editorState.getSelection();
    let blockKey = selection.getStartKey();
    let block = content.getBlockForKey(blockKey);
    let blockAlignment = block.getData().get('textAlign');

    let buttons = (toolbarConfig.BLOCK_ALIGNMENT_BUTTONS || []).map((type, index) => (
      <StyleButton
        {...toolbarConfig.extraProps}
        key={String(index)}
        isActive={blockAlignment === type.style}
        label={type.label}
        onToggle={this._toggleAlignment}
        style={type.style}
        className={type.className}
      />
    ));
    return (
      <ButtonGroup key={name}>{buttons}</ButtonGroup>
    );
  }

  _renderLinkButtons(name: string, toolbarConfig: ToolbarConfig) {
    let { editorState } = this.props;
    let selection = editorState.getSelection();
    let entity = this._getEntityAtCursor();
    let hasSelection = !selection.isCollapsed();
    let isCursorOnLink = (entity != null && entity.type === ENTITY_TYPE.LINK);
    let shouldShowLinkButton = hasSelection || isCursorOnLink;
    let defaultValue = (entity && isCursorOnLink) ? entity.getData().url : '';
    let config = toolbarConfig.LINK_BUTTONS || {};
    let linkConfig = config.link || {};
    let removeLinkConfig = config.removeLink || {};
    let linkLabel = linkConfig.label || 'Link';
    let removeLinkLabel = removeLinkConfig.label || 'Remove Link';
    let targetBlank = (entity && isCursorOnLink) ? entity.getData().target === '_blank' : false;
    let noFollow = (entity && isCursorOnLink) ? entity.getData().rel === 'nofollow' : false;

    return (
      <ButtonGroup key={name}>
        <PopoverIconButton
          label={linkLabel}
          iconName="link"
          isDisabled={!shouldShowLinkButton}
          showPopover={this.state.showLinkInput}
          onTogglePopover={this._toggleShowLinkInput}
          defaultValue={defaultValue}
          onSubmit={this._setLink}
          checkOptions={{
            targetBlank: { label: 'Open link in new tab', defaultValue: targetBlank },
            noFollow: { label: 'No follow', defaultValue: noFollow },
          }}
        />
        <IconButton
          {...toolbarConfig.extraProps}
          label={removeLinkLabel}
          iconName="remove-link"
          isDisabled={!isCursorOnLink}
          onClick={this._removeLink}
          focusOnClick={false}
        />
      </ButtonGroup>
    );
  }

  _renderImageButton(name: string, toolbarConfig: ToolbarConfig) {
    const config = (toolbarConfig.IMAGE_BUTTON || {});
    const label = config.label || 'Image';
    return (
      <ButtonGroup key={name}>
        <PopoverIconButton
          label={label}
          iconName="image"
          showPopover={this.state.showImageInput}
          onTogglePopover={this._toggleShowImageInput}
          onSubmit={this._setImage}
        />
      </ButtonGroup>
    );
  }

  _renderUndoRedo(name: string, toolbarConfig: ToolbarConfig) {
    let { editorState } = this.props;
    let canUndo = editorState.getUndoStack().size !== 0;
    let canRedo = editorState.getRedoStack().size !== 0;
    const config = toolbarConfig.HISTORY_BUTTONS || {};
    const undoConfig = config.undo || {};
    const redoConfig = config.redo || {};
    const undoLabel = undoConfig.label || 'Undo';
    const redoLabel = redoConfig.label || 'Redo';
    return (
      <ButtonGroup key={name}>
        <IconButton
          {...toolbarConfig.extraProps}
          label={undoLabel}
          iconName="undo"
          isDisabled={!canUndo}
          onClick={this._undo}
          focusOnClick={false}
        />
        <IconButton
          {...toolbarConfig.extraProps}
          label={redoLabel}
          iconName="redo"
          isDisabled={!canRedo}
          onClick={this._redo}
          focusOnClick={false}
        />
      </ButtonGroup>
    );
  }

  _onKeypress(event: Object, eventFlags: Object) {
    // Catch cmd+k for use with link insertion.
    if (hasCommandModifier(event) && event.keyCode === 75) {
      let { editorState } = this.props;
      if (!editorState.getSelection().isCollapsed()) {
        this.setState({ showLinkInput: true });
        eventFlags.wasHandled = true;
      }
    }
  }

  _toggleShowLinkInput(event: ?Object) {
    let isShowing = this.state.showLinkInput;
    // If this is a hide request, decide if we should focus the editor.
    if (isShowing) {
      let shouldFocusEditor = true;
      if (event && event.type === 'click') {
        // TODO: Use a better way to get the editor root node.
        let editorRoot = ReactDOM.findDOMNode(this).parentNode;
        let { activeElement } = document;
        let wasClickAway = (activeElement == null || activeElement === document.body);
        if (!wasClickAway && !editorRoot.contains(activeElement)) {
          shouldFocusEditor = false;
        }
      }
      if (shouldFocusEditor) {
        this.props.focusEditor();
      }
    }
    this.setState({ showLinkInput: !isShowing });
  }

  _toggleShowImageInput(event: ?Object) {
    let isShowing = this.state.showImageInput;
    // If this is a hide request, decide if we should focus the editor.
    if (isShowing) {
      let shouldFocusEditor = true;
      if (event && event.type === 'click') {
        // TODO: Use a better way to get the editor root node.
        let editorRoot = ReactDOM.findDOMNode(this).parentNode;
        let { activeElement } = document;
        let wasClickAway = (activeElement == null || activeElement === document.body);
        if (!wasClickAway && !editorRoot.contains(activeElement)) {
          shouldFocusEditor = false;
        }
      }
      if (shouldFocusEditor) {
        this.props.focusEditor();
      }
    }
    this.setState({ showImageInput: !isShowing });
  }

  _setImage(src: string) {
    let { editorState } = this.props;
    let contentState = editorState.getCurrentContent();
    let selection = editorState.getSelection();
    contentState = contentState.createEntity(ENTITY_TYPE.IMAGE, 'IMMUTABLE', { src });
    let entityKey = contentState.getLastCreatedEntityKey();
    let newContentState = Modifier.insertText(contentState, selection, ' ', null, entityKey);
    this.setState({ showImageInput: false });
    this.props.onChange(
      EditorState.push(editorState, newContentState)
    );
    this._focusEditor();
  }

  _setLink(url: string, checkOptions: { [key: string]: boolean }) {
    let { editorState } = this.props;
    let contentState = editorState.getCurrentContent();
    let selection = editorState.getSelection();
    let origSelection = selection;
    let canApplyLink = false;

    if (selection.isCollapsed()) {
      let entity = this._getEntityDescriptionAtCursor();
      if (entity) {
        canApplyLink = true;
        selection = selection.merge({
          anchorOffset: entity.startOffset,
          focusOffset: entity.endOffset,
          isBackward: false,
        });
      }
    } else {
      canApplyLink = true;
    }

    this.setState({ showLinkInput: false });
    if (canApplyLink) {
      let target = checkOptions.targetBlank ? '_blank' : undefined;
      let rel = checkOptions.noFollow ? 'nofollow' : undefined;
      contentState = contentState.createEntity(ENTITY_TYPE.LINK, 'MUTABLE', { url, target, rel });
      let entityKey = contentState.getLastCreatedEntityKey();

      editorState = EditorState.push(editorState, contentState);
      editorState = RichUtils.toggleLink(editorState, selection, entityKey);
      editorState = EditorState.acceptSelection(editorState, origSelection);

      this.props.onChange(editorState);
    }
    this._focusEditor();
  }

  _removeLink() {
    let { editorState } = this.props;
    let entity = getEntityAtCursor(editorState);
    if (entity != null) {
      let { blockKey, startOffset, endOffset } = entity;
      this.props.onChange(
        clearEntityForRange(editorState, blockKey, startOffset, endOffset)
      );
    }
  }

  _getEntityDescriptionAtCursor(): ?EntityDescription {
    let { editorState } = this.props;
    return getEntityAtCursor(editorState);
  }

  _getEntityAtCursor(): ?Entity {
    let { editorState } = this.props;
    let contentState = editorState.getCurrentContent();
    let entity = getEntityAtCursor(editorState);
    return (entity == null) ? null : contentState.getEntity(entity.entityKey);
  }

  _getCurrentBlockType(): string {
    let { editorState } = this.props;
    let selection = editorState.getSelection();
    return editorState
      .getCurrentContent()
      .getBlockForKey(selection.getStartKey())
      .getType();
  }

  indent = (isIndent) => () => {
    const style = isIndent ? 'text-indent' : '';

    let { editorState } = this.props;
    let selection = editorState.getSelection();
    let contentState = editorState.getCurrentContent();

    const blockKey = selection.getStartKey();
    const currentBlock = editorState.getCurrentContent().getBlockForKey(blockKey);
    const type = currentBlock.getType();

    if (type === "unordered-list-item" || type === "ordered-list-item") {
      let newEditorState = RichUtils.onTab(
        {
          which: () => 9,
          keyCode: () => 9,
          key: () => "Tab",
          preventDefault: () => { },
          shiftKey: !isIndent
        },
        editorState,
        2
      );

      if (newEditorState !== editorState) {
        this.props.onChange(newEditorState);
      }
      return;
    }

    let nextContentState = contentState.createEntity(isIndent ? 'LINK' : 'SPAN', 'MUTABLE', { className: style });
    let entityKey = nextContentState.getLastCreatedEntityKey();
    let nextEditorState = RichUtils.toggleLink(editorState, selection, entityKey);

    this.props.onChange(nextEditorState, isIndent);
  };

  _selectBlockType() {
    this._toggleBlockType(...arguments);
    this._focusEditor();
  }

  _toggleBlockType(blockType: string) {
    this.props.onChange(
      RichUtils.toggleBlockType(
        this.props.editorState,
        blockType
      )
    );
  }

  _toggleInlineStyle(inlineStyle: string) {
    const updatedState = getStateWithFullWordSelection(this.props.editorState);
    this.props.onChange(RichUtils.toggleInlineStyle(updatedState, inlineStyle));
  }

  _toggleAlignment(textAlign: string) {
    let { editorState } = this.props;
    let selection = editorState.getSelection();

    let content = editorState.getCurrentContent();
    let blockKey = selection.getStartKey();
    let block = content.getBlockForKey(blockKey);
    let blockData = block.getData();

    let newBlockData;
    if (blockData.get('textAlign') === textAlign) {
      newBlockData = blockData.remove('textAlign');
    } else {
      newBlockData = blockData.set('textAlign', textAlign);
    }

    let newBlock = block.set('data', newBlockData);

    let newContent = content.merge({
      blockMap: content.getBlockMap().set(blockKey, newBlock),
    });
    let newState = EditorState.push(
      editorState,
      newContent,
      'change-block-data'
    );
    this.props.onChange(newState);
  }

  _undo() {
    let { editorState } = this.props;
    this.props.onChange(
      EditorState.undo(editorState)
    );
  }

  _redo() {
    let { editorState } = this.props;
    this.props.onChange(
      EditorState.redo(editorState)
    );
  }

  _focusEditor() {
    // Hacky: Wait to focus the editor so we don't lose selection.
    setTimeout(() => {
      this.props.focusEditor();
    }, 50);
  }
}

export const processEndBlockValue = (offset, endBlockValue) => {
  let endPosition = offset; // Initialize endPosition with the given offset

  if (endBlockValue && endPosition < endBlockValue.length && endBlockValue[endPosition - 1] !== ' ') {
    // Find the next space or reach the end of the string
    while (endPosition < endBlockValue.length && endBlockValue[endPosition] !== ' ') {
      endPosition++;
    }
  }
  return endPosition; // Return the updated endPosition
};

export const processStartBlockValue = (offset, startBlockValue) => {
  let startPosition = offset; // Initialize startPosition with the given offset

  if (startBlockValue && startPosition > 0 && startBlockValue[startPosition - 1] !== ' ') {
    // Find the nearest space or reach the beginning of the string
    while (startPosition > 0 && startBlockValue[startPosition - 1] !== ' ') {
      startPosition--;
    }
  }
  return startPosition; // Return the updated startPosition
};

export const checkWhitespaceSelection = (
  focusOffset,
  anchorOffset,
  startBlockValue,
  endBlockValue
) => {
  if (startBlockValue !== endBlockValue) {
    return false;
  }
  if (focusOffset !== anchorOffset) {
    return false;
  }
  const prev = startBlockValue[focusOffset - 1] === ' ';
  const next = endBlockValue[anchorOffset] === ' ';
  return prev === next;
};

export const getStateWithFullWordSelection = (editorState: EditorState): EditorState => {
  const selectionState = editorState.getSelection();
  let anchorKey = selectionState.getAnchorKey();
  let focusKey = selectionState.getFocusKey();
  let anchorOffset = selectionState.getEndOffset();
  let focusOffset = selectionState.getStartOffset();

  const isBackward = selectionState.getIsBackward();

  // nothing is selected
  if (focusOffset === anchorOffset && anchorKey === focusKey) {
    return editorState;
  }

  const currentContent = editorState.getCurrentContent();
  const endBlockValue = currentContent.getBlockForKey(anchorKey).getText();
  const startBlockValue = currentContent.getBlockForKey(focusKey).getText();

  if (isBackward || anchorKey === focusKey) {
    anchorOffset = processEndBlockValue(anchorOffset, endBlockValue);
    focusOffset = processStartBlockValue(focusOffset, startBlockValue);
  } else {
    const save = anchorKey;
    anchorKey = focusKey;
    focusKey = save;
    anchorOffset = processEndBlockValue(anchorOffset, startBlockValue);
    focusOffset = processStartBlockValue(focusOffset, endBlockValue);
  }

  const newSelectionState = selectionState.merge({
    anchorOffset: anchorOffset,
    focusOffset: focusOffset,
    anchorKey: anchorKey,
    focusKey: focusKey,
    isBackward: true,
  });

  return EditorState.forceSelection(editorState, newSelectionState);
};
