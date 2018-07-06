import React from 'react';
import PropTypes from 'prop-types';
import ControlledVocab from '@folio/stripes-smart-components/lib/ControlledVocab';

class WaiveSettings extends React.Component {
  static propTypes = {
    stripes: PropTypes.shape({
      connect: PropTypes.func.isRequired,
      intl: PropTypes.object.isRequired,
    }).isRequired,
  };

  constructor(props) {
    super(props);
    this.connectedControlledVocab = props.stripes.connect(ControlledVocab);
  }
  render() {
    return (
      <this.connectedControlledVocab
        {...this.props}
        baseUrl="waives"
        records="waives"
        label={this.props.stripes.intl.formatMessage({ id: 'ui-users.waives.label' })}
        labelSingular={this.props.stripes.intl.formatMessage({ id: 'ui-users.waives.singular' })}
        objectLabel=""
        visibleFields={['nameReason', 'description']}
        columnMapping={{
          'nameReason': this.props.stripes.intl.formatMessage({ id: 'ui-users.waives.columns.reason' }),
           'description': this.props.stripes.intl.formatMessage({ id: 'ui-users.waives.columns.desc' }),
        }}
        nameKey="waiveReasons"
        hiddenFields={['numberOfObjects']}
        id="waives"
      />
    );
  }
}

export default WaiveSettings;