/* @flow */

import React from 'react';
import cx from 'classnames';

import styles from './ButtonGroup.css';

type Props = {
  className?: string;
  innerRef?: any;
};

export default function ButtonGroup(props: Props) {
  let className = cx(props.className, styles.root);
  return (
    <div {...props} className={className} ref={props.innerRef}/>
  );
}
