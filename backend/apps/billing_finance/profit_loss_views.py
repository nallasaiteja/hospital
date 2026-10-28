from django.http import HttpResponse
from rest_framework import views, status, permissions
from rest_framework.response import Response

from .profit_loss_service import ProfitLossService


class ProfitLossDashboardAPIView(views.APIView):
    """
    Executive P&L Dashboard endpoint:
    Returns the 21 master hospital metrics, previous period comparison cards,
    and visual chart datasets (Monthly trend, Department revenue, Category expense, Branch performance).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        period_type = request.query_params.get('period_type', 'ANNUAL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')
        fiscal_year_id = request.query_params.get('fiscal_year_id')

        try:
            data = ProfitLossService.get_dashboard_data(
                period_type=period_type,
                start_date=start_date,
                end_date=end_date,
                branch_id=branch_id,
                department_id=department_id,
                fiscal_year_id=fiscal_year_id
            )
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProfitLossDetailedReportAPIView(views.APIView):
    """
    Multi-step GAAP/IFRS Income Statement report:
    Gross revenue -> Net Revenue -> COGS -> Gross Profit -> Operating Expenses ->
    Operating Profit -> Non-Operating Income -> Financing Expenses -> PBT -> Taxes -> Net Profit.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')

        try:
            report = ProfitLossService.get_detailed_pnl_report(
                start_date=start_date,
                end_date=end_date,
                branch_id=branch_id,
                department_id=department_id
            )
            return Response(report, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class DepartmentProfitabilityAPIView(views.APIView):
    """
    Department-wise profitability breakdown:
    Direct revenue, direct expenses, allocated shared overhead, operating profit, and profit margin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')

        try:
            data = ProfitLossService.get_department_profitability(
                start_date=start_date,
                end_date=end_date,
                branch_id=branch_id
            )
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BranchProfitabilityAPIView(views.APIView):
    """
    Branch-wise profitability and multi-branch comparison with inter-branch eliminations.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        try:
            data = ProfitLossService.get_branch_profitability(
                start_date=start_date,
                end_date=end_date
            )
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProfitLossDrilldownAPIView(views.APIView):
    """
    Ledger drill-down:
    Retrieves the exact posted journal vouchers and line items that compose any reported P&L line.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        account_code = request.query_params.get('account_code')
        account_id = request.query_params.get('account_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')

        try:
            drilldown = ProfitLossService.get_account_drilldown(
                account_code=account_code,
                account_id=account_id,
                start_date=start_date,
                end_date=end_date,
                branch_id=branch_id,
                department_id=department_id
            )
            return Response(drilldown, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProfitLossExportCSVView(views.APIView):
    """
    Exports the complete Profit and Loss Statement as a formatted CSV file.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')

        try:
            csv_content = ProfitLossService.generate_pnl_csv(
                start_date=start_date,
                end_date=end_date,
                branch_id=branch_id,
                department_id=department_id
            )
            response = HttpResponse(csv_content, content_type='text/csv')
            filename = f"profit_loss_report_{start_date or 'all'}_to_{end_date or 'today'}.csv"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
