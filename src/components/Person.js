import React from 'react';

const person = props => {
    return (
        <p>
            {' '}
            I'am {props.name} : {Math.random() * 30}{' '}
        </p>
    );
};
export default person;
