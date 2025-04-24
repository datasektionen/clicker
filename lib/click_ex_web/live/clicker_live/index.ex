defmodule ClickExWeb.ClickerLive.Index do
  alias ClickEx.Clickers
  use ClickExWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="flex items-center justify-center h-screen bg-base-200">
      <div class="card shadow-xl bg-base-100 p-6">
        <h1 class="text-2xl font-bold mb-4 text-center">Welcome to Clickerland</h1>
        <button phx-click="new" class="btn btn-primary w-full">
          🚀 Create Clicker
        </button>
      </div>
    </div>
    """
  end

  def handle_event("new", _params, socket) do
    case Clickers.create_clicker(%{}) do
      {:ok, clicker} ->
        {:noreply,
         redirect(socket, to: ~p"/#{clicker}")
         |> put_flash(:info, "Clicker created")}

      {:error, _changeset} ->
        {:noreply, put_flash(socket, :error, "something went wrong")}
    end
  end
end
