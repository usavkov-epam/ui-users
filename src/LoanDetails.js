import { get, upperFirst, isEmpty } from 'lodash';
import React from 'react';
import {
  FormattedMessage,
  FormattedTime,
  injectIntl,
  intlShape,
} from 'react-intl';
import Link from 'react-router-dom/Link';
import PropTypes from 'prop-types';
import { ChangeDueDateDialog } from '@folio/stripes/smart-components';
import {
  Paneset,
  Pane,
  Modal,
  Button,
  Popover,
  MultiColumnList,
  KeyValue,
  Row,
  Col,
} from '@folio/stripes/components';
import { IfPermission } from '@folio/stripes/core';
import * as nav from './navigationHandlers';
import PatronBlockModal from './components/PatronBlock/PatronBlockModal';
import { getFullName } from './util';
import loanActionMap from './data/loanActionMap';
import LoanProxyDetails from './LoanProxyDetails';
import ViewLoading from './components/Loading/ViewLoading';

/**
 * Detail view of a user's loan.
 */
class LoanDetails extends React.Component {
  static propTypes = {
    stripes: PropTypes.object.isRequired,
    resources: PropTypes.shape({
      loanActions: PropTypes.object,
      loanActionsWithUser: PropTypes.object,
    }).isRequired,
    mutator: PropTypes.shape({
      loanActionsWithUser: PropTypes.shape({
        replace: PropTypes.func,
      }),
      userIds: PropTypes.shape({
        replace: PropTypes.func,
      }),
    }).isRequired,
    loan: PropTypes.object,
    patronGroup: PropTypes.object,
    // loanid: PropTypes.string,
    user: PropTypes.object,
    // onCancel: PropTypes.func.isRequired,
    // onClickUser: PropTypes.func.isRequired,
    // onClickViewAllAccounts: PropTypes.func.isRequired,
    // onClickViewClosedAccounts: PropTypes.func.isRequired,
    // onClickViewOpenAccounts: PropTypes.func.isRequired,
    // onClickViewAccountActionsHistory: PropTypes.func.isRequired,
    loanPolicies: PropTypes.arrayOf(PropTypes.object),
    requestCounts: PropTypes.object,
    renew: PropTypes.func,
    patronBlocks: PropTypes.arrayOf(PropTypes.object),
    intl: intlShape.isRequired,
    match: PropTypes.object.isRequired,
    history: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.nav = null;
    this.connectedChangeDueDateDialog = props.stripes.connect(ChangeDueDateDialog);
    this.renew = this.renew.bind(this);
    this.getContributorslist = this.getContributorslist.bind(this);
    this.showContributors = this.showContributors.bind(this);
    this.hideNonRenewedLoansModal = this.hideNonRenewedLoansModal.bind(this);
    this.showTitle = this.showTitle.bind(this);
    this.showChangeDueDateDialog = this.showChangeDueDateDialog.bind(this);
    this.hideChangeDueDateDialog = this.hideChangeDueDateDialog.bind(this);
    this.getFeeFine = this.getFeeFine.bind(this);
    this.viewFeeFine = this.viewFeeFine.bind(this);

    this.state = {
      nonRenewedLoanItems: [],
      nonRenewedLoansModalOpen: false,
      changeDueDateDialogOpen: false,
      feesFines: {},
      patronBlockedModal: false,
    };
  }

  componentDidMount() {
    this.getLoanActions();
    this.getFeeFine();
  }

  componentDidUpdate(prevProps) {
    this.updateLoanActionsOnOverride(prevProps);
  }

  updateLoanActionsOnOverride(prevProps) {
    if (this.props.loan && prevProps.loan) {
      const {
        loan: {
          renewalCount
        }
      } = this.props;

      const {
        loan: {
          renewalCount: prevRenewalCount
        }
      } = prevProps;
      const isRenewalCountChanged = prevRenewalCount && renewalCount && renewalCount !== prevRenewalCount;

      if (isRenewalCountChanged) {
        this.getLoanActions();
      }
    }
  }

  getContributorslist(loan) {
    this.loan = loan;
    const contributors = get(this.loan, ['item', 'contributors']);
    const contributorsList = [];
    if (typeof contributors !== 'undefined') {
      Object.keys(contributors).forEach(contributor => contributorsList.push(`${contributors[contributor].name}; `));
    } else {
      contributorsList.push('-');
    }
    return contributorsList;
  }

  hideChangeDueDateDialog() {
    this.setState({
      changeDueDateDialogOpen: false,
    });
  }

  hideNonRenewedLoansModal() {
    this.setState({ nonRenewedLoansModalOpen: false });
  }

  joinLoanActionsWithUser(loanActions, users) {
    const userMap = users.reduce((memo, user) => {
      return Object.assign(memo, { [user.id]: user });
    }, {});
    const records = loanActions.map(la => {
      return Object.assign({}, la, { user: userMap[la.metadata.updatedByUserId] });
    });

    this.props.mutator.loanActionsWithUser.replace({ records });
  }

  renew() {
    const {
      loan,
      user,
      patronBlocks,
      renew,
    } = this.props;
    const countRenew = patronBlocks.filter(p => p.renewals);

    if (!isEmpty(countRenew)) return this.setState({ patronBlockedModal: true });

    return renew([loan], user)
      .then(this.getLoanActions);
  }

  getUsers(loanActions) {
    const { mutator } = this.props;
    const query = loanActions
      .map(r => `id==${r.metadata.updatedByUserId}`)
      .join(' or ');

    mutator.users.reset();
    mutator.users.GET({ params: { query } })
      .then(users => this.joinLoanActionsWithUser(loanActions, users));
  }

  getLoanActions = () => {
    const {
      mutator,
      match: { params }
    } = this.props;
    const query = `id==${params.loanid}`;
    const limit = 100;

    mutator.loanActions.reset();
    mutator.loanActions.GET({ params: { query, limit } })
      .then(loanActions => this.getUsers(loanActions));
  };

  getFeeFine() {
    const { mutator, match: { params } } = this.props;
    const query = `loanId=${params.loanid}`;

    mutator.loanAccountsActions.GET({ params: { query } }).then(records => {
      const total = records.reduce((a, { amount }) => (a + parseFloat(amount)), 0);
      this.setState({ feesFines: { total, accounts: records } });
    });
  }

  viewFeeFine() {
    const { feesFines: { total } } = this.state;
    return (total === 0) ? '-' : (
      <button
        style={{ color: '#2b75bb' }}
        onClick={(e) => this.feefinedetails(e)}
        type="button"
      >
        {parseFloat(total).toFixed(2)}
      </button>
    );
  }

  feefinedetails = (e) => {
    const { feesFines: { accounts } } = this.state;
    const loan = this.loan || {};
    if (accounts.length === 1) {
      nav.onClickViewAccountActionsHistory(e, { id: accounts[0].id });
    } else if (accounts.length > 1) {
      const open = accounts.filter(a => a.status.name === 'Open') || [];
      if (open.length === accounts.length) {
        nav.onClickViewOpenAccounts(e, loan);
      } else if (open.length === 0) {
        nav.onClickViewClosedAccounts(e, loan);
      } else {
        nav.onClickViewAllAccounts(e, loan);
      }
    }
  };

  onClosePatronBlockedModal = () => {
    this.setState({ patronBlockedModal: false });
  };

  showChangeDueDateDialog() {
    this.setState({
      changeDueDateDialogOpen: true,
    });
  }

  showContributors(list, listTodisplay, contributorsLength) {
    this.list = list;
    const contributorsList = <KeyValue
      label={<FormattedMessage id="ui-users.loans.columns.contributors" />}
      value={listTodisplay}
    />;

    return (contributorsLength >= 77) ?
      (
        <Popover>
          <div data-role="target" style={{ cursor: 'pointer' }}>
            {contributorsList}
          </div>
          <div data-role="popover">
            {
              this.list.map(contributor => <p key={contributor}>{contributor}</p>)
            }
          </div>
        </Popover>
      ) : contributorsList;
  }

  showTitle(loan) {
    this.loan = loan;
    const title = `${get(this.loan, ['item', 'title'], '')}`;
    if (title) {
      const titleTodisplay = (title.length >= 77) ? `${title.substring(0, 77)}...` : title;
      return <KeyValue
        label={<FormattedMessage id="ui-users.loans.columns.title" />}
        value={(
          <Link to={`/inventory/view/${get(this.loan, ['item', 'instanceId'], '')}`}>
            {`${titleTodisplay} (${get(this.loan, ['item', 'materialType', 'name'])})`}
          </Link>
        )}
      />;
    }
    return '-';
  }

  renderChangeDueDateDialog() {
    return (
      <this.connectedChangeDueDateDialog
        stripes={this.props.stripes}
        loanIds={[{ id: this.props.loan.id }]}
        onClose={this.hideChangeDueDateDialog}
        open={this.state.changeDueDateDialogOpen}
      />
    );
  }

  handleClose = () => {
    const { loan, history, match: { params } } = this.props;
    // if this loan detail was accessed through a fee/fine, accountid will be present.
    if (params.accountid) {
      history.push(`/users/${params.id}/accounts/view/${params.accountid}`);
    }
    const loanStatus = loan.status ? loan.status.name.toLowerCase() : 'open';
    history.push(`/users/${params.id}/loans/${loanStatus}`);
  }

  render() {
    const {
      history,
      loan,
      patronGroup,
      patronBlocks,
      user,
      resources: {
        loanActionsWithUser,
      },
      stripes,
      intl,
      loanPolicies,
      requestCounts,
    } = this.props;

    const {
      patronBlockedModal,
    } = this.state;

    if (!loan) {
      return (
        <ViewLoading
          inPaneset
          defaultWidth="100%"
          paneTitle="Loan action history"
        />
      );
    }

    const loanPolicyName = isEmpty(loanPolicies)
      ? '-'
      : loanPolicies[loan.loanPolicyId];

    if (!loanPolicyName) {
      return <div />;
    }

    const { nonRenewedLoanItems } = this.state;
    const loanActionsFormatter = {
      action: la => <FormattedMessage id={loanActionMap[la.action]} />,
      actionDate: la => <FormattedTime value={get(la, ['metadata', 'updatedDate'], '-')} day="numeric" month="numeric" year="numeric" />,
      dueDate: la => <FormattedTime value={la.dueDate} day="numeric" month="numeric" year="numeric" />,
      itemStatus: la => la.itemStatus,
      source: la => <Link to={`/users/view/${la.user.id}`}>{getFullName(la.user)}</Link>,
      comments: ({ actionComment }) => (actionComment || '-'),
    };

    const itemRequestCount = requestCounts[this.props.loan.itemId] || 0;
    const requestQueueValue = (itemRequestCount && stripes.hasPerm('ui-users.requests.all,ui-requests.all'))
      ? (<Link to={`/requests?filters=requestStatus.Open%20-%20Not%20yet%20filled%2CrequestStatus.Open%20-%20Awaiting%20pickup%2CrequestStatus.Open%20-%20In%20transit&query=${loan.item.barcode}&sort=Request%20Date`}>{itemRequestCount}</Link>)
      : itemRequestCount;
    const contributorsList = this.getContributorslist(loan);
    const contributorsListString = contributorsList.join(' ');
    const contributorsLength = contributorsListString.length;
    const loanStatus = get(loan, ['status', 'name'], '-');
    const buttonDisabled = (loanStatus && loanStatus === 'Closed');
    // Number of characters to trucate the string = 77
    const listTodisplay = (contributorsList === '-') ? '-' : (contributorsListString.length >= 77) ? `${contributorsListString.substring(0, 77)}...` : `${contributorsListString.substring(0, contributorsListString.length - 2)}`;
    const nonRenewedLabel = <FormattedMessage id="ui-users.loans.items.nonRenewed.label" />;
    const failedRenewalsSubHeading = (
      <p>
        <FormattedMessage
          id="ui-users.loans.items.nonRenewed.subHeading"
          values={{
            strongCount: <strong>{nonRenewedLoanItems.length}</strong>,
            count: nonRenewedLoanItems.length,
            verb: <strong>{<FormattedMessage id="ui-users.loans.item.nonRenewed.callout.verb" />}</strong>,
          }}
        />
      </p>
    );

    return (
      <div data-test-loan-actions-history>
        <Paneset isRoot>
          <Pane
            id="pane-loandetails"
            defaultWidth="100%"
            dismissible
            onClose={() => { history.goBack(); }}
            paneTitle={(
              <FormattedMessage id="ui-users.loans.loanDetails">
                {(loanDetails) => `${loanDetails} - ${getFullName(user)} (${upperFirst(patronGroup.group)})`}
              </FormattedMessage>
          )}
          >
            <Row>
              <span>
                <Button
                  disabled={buttonDisabled}
                  buttonStyle="primary"
                  onClick={this.renew}
                >
                  <FormattedMessage id="ui-users.renew" />
                </Button>
                <Button
                  disabled={buttonDisabled}
                  buttonStyle="primary"
                  onClick={this.showChangeDueDateDialog}
                >
                  <FormattedMessage id="stripes-smart-components.cddd.changeDueDate" />
                </Button>
              </span>
            </Row>
            <Row>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.borrower" />}
                  value={getFullName(user)}
                />
              </Col>
              <Col xs={2}>
                <LoanProxyDetails
                  id={loan.proxyUserId}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={2}>
                {this.showTitle(loan)}
              </Col>
              <Col xs={2}>
                {this.showContributors(contributorsList, listTodisplay, contributorsLength)}
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.columns.barcode" />}
                  value={<Link to={`/inventory/view/${get(loan, ['item', 'instanceId'], '')}/${get(loan, ['item', 'holdingsRecordId'], '')}/${get(loan, ['itemId'], '')}`}>{get(loan, ['item', 'barcode'], '')}</Link>}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.callNumber" />}
                  value={get(loan, ['item', 'callNumber'], '-')}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.location" />}
                  value={get(loan, ['item', 'location', 'name'], '-')}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.columns.itemStatus" />}
                  value={get(loan, ['item', 'status', 'name'], '-')}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.columns.dueDate" />}
                  value={loan.dueDate ? (<FormattedTime value={loan.dueDate} day="numeric" month="numeric" year="numeric" />) : '-'}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.columns.returnDate" />}
                  value={loan.returnDate ? (<FormattedTime value={loan.returnDate} day="numeric" month="numeric" year="numeric" />) : '-'}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.renewalCount" />}
                  value={get(loan, ['renewalCount'], '-')}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.claimedReturned" />}
                  value="TODO"
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.checkinServicePoint" />}
                  value={get(loan, ['checkinServicePoint', 'name'], '-')}
                />
              </Col>
            </Row>
            <Row>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.loanPolicy" />}
                  value={<Link to={`/settings/circulation/loan-policies/${loan.loanPolicyId}`}>{loanPolicyName}</Link>}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.columns.loanDate" />}
                  value={<FormattedTime value={loan.loanDate} day="numeric" month="numeric" year="numeric" /> || '-'}
                />
              </Col>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.fine" />}
                  value={this.viewFeeFine()}
                />
              </Col>
              <IfPermission perm="ui-users.requests.all">
                <Col
                  data-test-loan-actions-history-requests
                  xs={2}
                >
                  <KeyValue
                    label={<FormattedMessage id="ui-users.loans.details.requestQueue" />}
                    value={requestQueueValue}
                  />
                </Col>
              </IfPermission>
              <Col xs={2}>
                <KeyValue
                  label={<FormattedMessage id="ui-users.loans.details.lost" />}
                  value="TODO"
                />
              </Col>
            </Row>
            <br />
            {loanActionsWithUser && loanActionsWithUser.records &&
            <MultiColumnList
              id="list-loanactions"
              formatter={loanActionsFormatter}
              visibleColumns={['actionDate', 'action', 'dueDate', 'itemStatus', 'source', 'comments']}
              columnMapping={{
                action: intl.formatMessage({ id: 'ui-users.loans.columns.action' }),
                actionDate: intl.formatMessage({ id: 'ui-users.loans.columns.actionDate' }),
                dueDate: intl.formatMessage({ id: 'ui-users.loans.columns.dueDate' }),
                itemStatus: intl.formatMessage({ id: 'ui-users.loans.columns.itemStatus' }),
                source: intl.formatMessage({ id: 'ui-users.loans.columns.source' }),
                comments: intl.formatMessage({ id: 'ui-users.loans.columns.comments' }),
              }}
              contentData={loanActionsWithUser.records}
            />
          }
            <Modal dismissible closeOnBackgroundClick onClose={this.hideNonRenewedLoansModal} open={this.state.nonRenewedLoansModalOpen} label={nonRenewedLabel}>
              {failedRenewalsSubHeading}
              {
                nonRenewedLoanItems.map((loanItem, index) => (
                  <li key={index}>
                    <span>{loanItem.item.title}</span>
                  </li>))
            }
            </Modal>
            <PatronBlockModal
              open={patronBlockedModal}
              onClose={this.onClosePatronBlockedModal}
              patronBlocks={patronBlocks}
              viewUserPath={`/users/view/${(user || {}).id}?filters=pg.${patronGroup.group}&sort=name`}
            />
            { this.renderChangeDueDateDialog() }
          </Pane>
        </Paneset>
      </div>
    );
  }
}

export default injectIntl(LoanDetails);