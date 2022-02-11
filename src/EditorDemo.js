/* @flow */
import React, { Component } from 'react';
import RichTextEditor, { createValueFromString } from './RichTextEditor';
import { convertToRaw } from 'draft-js';
import autobind from 'class-autobind';
import { getTextAlignBlockMetadata, getTextAlignClassName, getTextAlignStyles } from './lib/blockStyleFunctions';

import type { EditorValue } from './RichTextEditor';

type Props = {};
type State = {
  value: EditorValue;
  format: string;
  readOnly: boolean;
};

const toolbarConfig = {
  // Optionally specify the groups to display (displayed in the order listed).
  display: ['INLINE_STYLE_BUTTONS', 'BLOCK_TYPE_BUTTONS', 'LINK_BUTTONS', 'BLOCK_TYPE_DROPDOWN', 'COLOR_DROPDOWN'],
  INLINE_STYLE_BUTTONS: [
    { label: 'Bold', style: 'BOLD', className: 'custom-css-class' },
    { label: 'Italic', style: 'ITALIC' },
    { label: 'Underline', style: 'UNDERLINE' }
  ],
  BLOCK_TYPE_DROPDOWN: [
    { label: 'Normal', style: 'unstyled' },
    { label: 'Heading Large', style: 'header-one' },
    { label: 'Heading Medium', style: 'header-two' },
    { label: 'Heading Small', style: 'header-three' }
  ],
  BLOCK_TYPE_BUTTONS: [
    { label: 'UL', style: 'unordered-list-item' },
    { label: 'OL', style: 'ordered-list-item' }
  ],
  COLOR_DROPDOWN: [
    { label: 'Default', style: 'default-dropdown_option' },
    { label: 'Red', style: 'red-dropdown_option' },
    { label: 'Orange', style: 'orange-dropdown_option' },
    { label: 'Yellow', style: 'yellow-dropdown_option' },
    { label: 'Green', style: 'green-dropdown_option' },
    { label: 'Blue', style: 'blue-dropdown_option' },
    { label: 'Indigo', style: 'indigo-dropdown_option' },
    { label: 'Violet', style: 'violet-dropdown_option' },
  ],
  extraProps: {
    colorDropdownProps: {
      showColorLabel: false,
      colorWrapperClassname: 'test 2',
      colorSelectClassName: 'test 1'
    }
  }
};

export default class EditorDemo extends Component {
  props: Props;
  state: State;

  constructor() {
    super(...arguments);
    autobind(this);
    this.state = {
      value: createValueFromString('<p>test <a class="red-dropdown_option" url="" href="">asd asd</a><a class="green-dropdown_option" url="" href="">tttt</a></p>', 'html', {
        customInlineFn(elem, { Entity }) {
          const { tagName, className  } = elem;
          if (tagName === 'A' && colorStyleMap[className]) {
            return Entity('LINK', { className });
          }
        }
      }),
      format: 'html',
      readOnly: false,
    };
  }

  onChange = (value) => {
    this.setState({ value })
  };

  render() {
    let { value, format } = this.state;

    return (
      <div className="editor-demo">
        <div className="row">
          <p>This is a demo of the <a href="https://github.com/sstur/react-rte" target="top">react-rte</a> editor.</p>
        </div>
        <div className="row">
          <RichTextEditor
            value={value}
            onChange={this.onChange}
            className="react-rte-demo"
            placeholder="Tell a story"
            toolbarClassName="demo-toolbar"
            editorClassName="demo-editor"
            readOnly={this.state.readOnly}
            blockStyleFn={getTextAlignClassName}
            toolbarConfig={toolbarConfig}
            customStyleMap={colorStyleMap}
          />
        </div>
        <div className="row">
          <label className="radio-item">
            <input
              type="radio"
              name="format"
              value="html"
              checked={format === 'html'}
              onChange={this._onChangeFormat}
            />
            <span>HTML</span>
          </label>
          <label className="radio-item">
            <input
              type="radio"
              name="format"
              value="markdown"
              checked={format === 'markdown'}
              onChange={this._onChangeFormat}
            />
            <span>Markdown</span>
          </label>
          <label className="radio-item">
            <input
              type="checkbox"
              onChange={this._onChangeReadOnly}
              checked={this.state.readOnly}
            />
            <span>Editor is read-only</span>
          </label>
        </div>
        <div className="row">
          <textarea
            className="source"
            placeholder="Editor Source"
            value={value.toString(format, { blockStyleFn: getTextAlignStyles })}
            onChange={this._onChangeSource}
          />
        </div>
        <div className="row btn-row">
          <span className="label">Debugging:</span>
          <button className="btn" onClick={this._logState}>Log Content State</button>
          <button className="btn" onClick={this._logStateRaw}>Log Raw</button>
        </div>
      </div>
    );
  }

  _logState() {
    let editorState = this.state.value.getEditorState();
    let contentState = window.contentState = editorState.getCurrentContent().toJS();
    console.log(contentState);
  }

  _logStateRaw() {
    let editorState = this.state.value.getEditorState();
    let contentState = editorState.getCurrentContent();
    let rawContentState = window.rawContentState = convertToRaw(contentState);
    console.log(JSON.stringify(rawContentState));
  }

  _onChangeSource(event: Object) {
    let source = event.target.value;
    let oldValue = this.state.value;
    this.setState({
      vakue: oldValue.setContentFromString(source, this.state.format, { customBlockFn: getTextAlignBlockMetadata }),
    });
  }

  _onChangeFormat(event: Object) {
    this.setState({ format: event.target.value });
  }

  _onChangeReadOnly(event: Object) {
    this.setState({ readOnly: event.target.checked });
  }
}

const colorStyleMap = {
  'red-dropdown_option': {
    color: 'rgba(255, 0, 0, 1.0)',
  },
  'orange-dropdown_option': {
    color: 'rgba(255, 127, 0, 1.0)',
  },
  'yellow-dropdown_option': {
    color: 'rgba(180, 180, 0, 1.0)',
  },
  'green-dropdown_option': {
    color: 'rgba(0, 180, 0, 1.0)',
  },
  'blue-dropdown_option': {
    color: 'rgba(0, 0, 255, 1.0)',
  },
  'indigo-dropdown_option': {
    color: 'rgba(75, 0, 130, 1.0)',
  },
  'violet-dropdown_option': {
    color: 'rgba(127, 0, 255, 1.0)',
  },
  'default-dropdown_option': {
    color: 'unset'
  }
};
