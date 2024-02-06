/* @flow */
import React, { Component } from 'react';
import RichTextEditor, { createValueFromString, createEmptyValue } from './RichTextEditor';
import { convertToRaw } from 'draft-js';
import autobind from 'class-autobind';
import { getTextAlignBlockMetadata, getTextAlignClassName, getTextAlignStyles } from './lib/blockStyleFunctions';

import type { EditorValue } from './RichTextEditor';

type Props = {};
type State = {
  value: EditorValue;
  value2: EditorValue;
  format: string;
  readOnly: boolean;
};

const toolbarConfig = {
  // Optionally specify the groups to display (displayed in the order listed).
  display: ['INLINE_STYLE_BUTTONS', 'BLOCK_TYPE_BUTTONS', /*LINK_BUTTONS*/ 'BLOCK_TYPE_DROPDOWN', 'EXTRA_OPTIONS'],
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
  TEST_BUTTONS: [
    {
      label: 'test',
      style: 'TEST'
    }
  ],
  EXTRA_OPTIONS: {
    add: () => <span>add yellow</span>,
    remove: () => <span>remove yellow</span>,
    insert: () => <span>insert</span>,
    indent: () => <span>indent</span>,
    outdent: () => <span>outdent</span>,
    symbols: () => <span>symbols</span>
  },
  extraProps: {}
};

export default class EditorDemo extends Component {
  props: Props;
  state: State;

  constructor() {
    super(...arguments);
    autobind(this);
    this.state = {
      value: createValueFromString('<p>111 222 333 444</p>', 'html', {
        customInlineFn(elem, { Entity }) {
          const { tagName, className } = elem;
          if (tagName === 'A' && colorStyleMap[className]) {
            return Entity('LINK', { className });
          }
          if (className.startsWith('fixed-width')) {
            return Entity('LINK', { className: className + ' public-fixed-width' });
          }
          if (className === 'text-outdent') {
            return Entity('SPAN');
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
            onBlur={() => {
              console.log('here')
            }}
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
  },
  'orange_insert-point': {
    backgroundColor: 'rgba(255, 127, 0, 1.0)',
    textDecoration: 'unset',
    color: '#FFFF'
  },
  'text-indent': {}
};
