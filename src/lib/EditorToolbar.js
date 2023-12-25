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
      color: 'default-dropdown_option'
    };
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
      <ButtonGroup key={name}>{buttons}</ButtonGroup>
    );
  }

  _renderInlineStyleButtons(name: string, toolbarConfig: ToolbarConfig) {
    let { editorState } = this.props;
    let currentStyle = editorState.getCurrentInlineStyle();
    let buttons = (toolbarConfig.INLINE_STYLE_BUTTONS || []).map((type, index) => (
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
      <ButtonGroup key={name}>{buttons}</ButtonGroup>
    );
  }

  _extraOptions(name: String, toolbarConfig: ToolbarConfig) {
    return (
      <ButtonGroup key={name}>
        {toolbarConfig.EXTRA_OPTIONS.add && (
          <button onClick={this.toggleColor(true)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.add()}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.remove && (
          <button onClick={this.toggleColor(false)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.remove()}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.indent && (
          <button onClick={this.indent(true)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.indent()}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.outdent && (
          <button onClick={this.indent(false)} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.outdent()}
          </button>
        )}
        {toolbarConfig.EXTRA_OPTIONS.insert && (
          <button onClick={this.props.onInsert} onMouseDown={(e) => e.preventDefault()}>
            {toolbarConfig.EXTRA_OPTIONS.insert()}
          </button>
        )}
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

  toggleColor = (isSelection) => () => {
    const toggledColor = isSelection ? 'yellow-dropdown_option' : 'default-dropdown_option';

    let { editorState, customStyleMap } = this.props;
    let selection = editorState.getSelection();
    let contentState = editorState.getCurrentContent();

    let origSelection = selection;

    // Let's just allow one color at a time. Turn off all active colors.
    let nextContentState = Object.keys(customStyleMap)
      .reduce((contentState, color) => {
        return Modifier.removeInlineStyle(contentState, selection, color)
      }, editorState.getCurrentContent());

    nextContentState = nextContentState.createEntity('LINK', 'MUTABLE', { className: toggledColor });

    let nextEditorState = EditorState.push(
      editorState,
      nextContentState,
      'change-inline-style'
    );

    const currentStyle = editorState.getCurrentInlineStyle();

    // Unset style override for current color.
    if (selection.isCollapsed()) {
      nextEditorState = currentStyle.reduce((state, color) => {
        return RichUtils.toggleInlineStyle(state, color);
      }, nextEditorState);
    }

    // If the color is being toggled on, apply it.
    if (!currentStyle.has(toggledColor)) {
      nextEditorState = RichUtils.toggleInlineStyle(
        nextEditorState,
        toggledColor
      );
    }

    let entityKey = nextContentState.getLastCreatedEntityKey();
    nextEditorState = EditorState.push(nextEditorState, contentState);
    nextEditorState = RichUtils.toggleLink(nextEditorState, selection, entityKey);
    nextEditorState = EditorState.acceptSelection(nextEditorState, origSelection);

    this.setState({ color: toggledColor });
    this.props.onChange(nextEditorState);
  }

  indent = (isIndent) => () => {
    const style = isIndent ? 'text-indent' : '';

    let { editorState, customStyleMap } = this.props;
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

    let origSelection = selection;

    // Let's just allow one color at a time. Turn off all active colors.
    let nextContentState = Object.keys(customStyleMap)
      .reduce((contentState, color) => {
        return Modifier.removeInlineStyle(contentState, selection, color)
      }, editorState.getCurrentContent());

    nextContentState = nextContentState.createEntity(isIndent ? 'LINK' : 'SPAN', 'MUTABLE', { className: style });

    let nextEditorState = EditorState.push(
      editorState,
      nextContentState,
      'change-inline-style'
    );

    const currentStyle = editorState.getCurrentInlineStyle();

    // Unset style override for current color.
    if (selection.isCollapsed()) {
      nextEditorState = currentStyle.reduce((state, color) => {
        return RichUtils.toggleInlineStyle(state, color);
      }, nextEditorState);
    }

    // If the color is being toggled on, apply it.
    if (!currentStyle.has(style)) {
      nextEditorState = RichUtils.toggleInlineStyle(
        nextEditorState,
        style
      );
    }

    let entityKey = nextContentState.getLastCreatedEntityKey();
    nextEditorState = EditorState.push(nextEditorState, contentState);
    nextEditorState = RichUtils.toggleLink(nextEditorState, selection, entityKey);
    nextEditorState = EditorState.acceptSelection(nextEditorState, origSelection);

    this.props.onChange(nextEditorState);
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
    const selectionState = this.props.editorState.getSelection();
    const anchorKey = selectionState.getAnchorKey();
    const focusKey = selectionState.getFocusKey();
    let anchorOffset = selectionState.getEndOffset();
    let focusOffset = selectionState.getStartOffset();

    // nothing is selected
    if (focusOffset === anchorOffset) {
      return this.props.onChange(RichUtils.toggleInlineStyle(this.props.editorState, inlineStyle));
    }

    const currentContent = this.props.editorState.getCurrentContent();
    const endBlockValue = currentContent.getBlockForKey(anchorKey).getText();
    const startBlockValue = currentContent.getBlockForKey(focusKey).getText();

    // selected all text or all block - no needs to change selection
    if (focusOffset === 0 && anchorOffset === startBlockValue.length) {
      return this.props.onChange(RichUtils.toggleInlineStyle(this.props.editorState, inlineStyle));
    }
    // check end
    if (
      endBlockValue &&
      anchorOffset !== endBlockValue.length &&
      endBlockValue[anchorOffset - 1] !== ' '
    ) {
      let found = false;
      for (let i = anchorOffset; i < endBlockValue.length; i++) {
        if (!found && endBlockValue[i] === ' ') {
          found = true;
          anchorOffset = i;
        }
        if (!found && i === endBlockValue.length - 1) {
          anchorOffset = i + 1;
        }
      }
    }

    // check start
    if (
      startBlockValue &&
      focusOffset !== 0 &&
      startBlockValue[focusOffset] !== ' '
    ) {
      let found = false;
      for (let i = focusOffset - 1; i >= 0; i--) {
        if (!found && startBlockValue[i] === ' ') {
          found = true;
          focusOffset = i + 1;
        }
        if (!found && i === 0) {
          focusOffset = i;
        }
      }
    }

    const newSelectionState = selectionState.merge({
      anchorOffset: anchorOffset,
      focusOffset: focusOffset,
      anchorKey: anchorKey,
      focusKey: focusKey,
    });

    const newState = EditorState.forceSelection(this.props.editorState, newSelectionState);
    this.props.onChange(RichUtils.toggleInlineStyle(newState, inlineStyle));
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
