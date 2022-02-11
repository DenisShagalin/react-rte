/* @flow */
import React, {Component} from 'react';
import autobind from 'class-autobind';
import cx from 'classnames';

import styles from './Dropdown.css';

type Choice = {
  label: string;
  className?: string;
};

type Props = {
  choices: Map<string, Choice>;
  selectedKey: ?string;
  onChange: (selectedKey: string) => any;
  className?: string;
  customOption: Function;
};

export default class Dropdown extends Component {
  props: Props;

  constructor() {
    super(...arguments);
    autobind(this);
  }

  render() {
    let {choices, selectedKey, className, valueStyle = {}, colorSelectClassName, ...otherProps} = this.props;
    className = cx(className, styles.root);
    let selectedItem = (selectedKey == null) ? null : choices.get(selectedKey);
    let selectedValue = selectedItem && selectedItem.label || '';
    return (
      <span className={className} title={selectedValue}>
        <select {...otherProps} value={selectedKey} onChange={this._onChange} className={colorSelectClassName}>
          {this._renderChoices()}
        </select>
        <span className={styles.value} style={valueStyle}>{selectedValue}</span>
      </span>
    );
  }

  _onChange(event: Object) {
    let value: string = event.target.value;
    this.props.onChange(value);
  }

  _renderChoices() {
    let {choices} = this.props;
    let entries = Array.from(choices.entries());
    return entries.map(([key, {label, className}]) => (
      this.props.customOption ? this.props.customOption(key, label, className) : <option key={key} value={key} className={className}>{label}</option>
    ));
  }
}
